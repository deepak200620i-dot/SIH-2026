"""
IBVAP — Face Recognition Demo Script
========================================
Opens a video, runs YOLO26n tracking per frame, then runs InsightFace
face recognition on every detected person crop.  Displays annotated
output with tracked IDs, fence zones, and face labels.

Usage:
    python scripts/run_face_demo.py
    python scripts/run_face_demo.py --video path/to/video.mp4
    python scripts/run_face_demo.py --gallery data/faces
    python scripts/run_face_demo.py --save   # saves output video
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2
import yaml

# Add project root to path so we can import src.*
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.tracking.tracker import Tracker
from src.rules.virtual_fence import VirtualFence
from src.face.recognizer import FaceRecognizer


def load_config(config_path: Path | None = None) -> dict:
    """Load settings.yaml from the config directory."""
    path = config_path or (PROJECT_ROOT / "config" / "settings.yaml")
    if not path.exists():
        print(f"[ERROR] Config not found: {path}")
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def run_demo(
    video_path: str,
    detection_config: dict,
    fence_config: dict,
    face_config: dict,
    save_output: bool = False,
    output_path: str | None = None,
) -> None:
    """Run the tracking + face recognition demo on a video file."""

    # ── Open video ───────────────────────────────────────────────────────
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video: {video_path}")
        sys.exit(1)

    fps_video = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"[INFO] Video: {video_path}")
    print(f"[INFO] Resolution: {width}x{height}  FPS: {fps_video:.1f}  Frames: {total_frames}")

    # ── Initialise tracker ──────────────────────────────────────────────
    tracker = Tracker(detection_config)
    print("[INFO] Warming up YOLO model + ByteTrack...")
    tracker.warmup()
    print("[INFO] Tracker ready.")

    # ── Initialise virtual fence ────────────────────────────────────────
    zones = fence_config.get("zones", [])
    cooldown = fence_config.get("cooldown_seconds", 30.0)
    fence = VirtualFence(zones, cooldown_seconds=cooldown)
    print(f"[INFO] Virtual fence loaded: {len(fence.zones)} zone(s)")

    # ── Initialise face recognizer ──────────────────────────────────────
    print("[INFO] Loading InsightFace model + face gallery...")
    recognizer = FaceRecognizer(face_config)
    print(f"[INFO] Face recognizer ready — gallery: {recognizer.gallery_size} person(s)")
    if recognizer.gallery_names:
        for name in recognizer.gallery_names:
            print(f"       • {name}")
    else:
        print("       (gallery is empty — all faces will be labelled UNKNOWN)")

    print("[INFO] Starting tracking + face recognition...\n")

    # ── Optional: video writer for saving output ─────────────────────────
    writer = None
    if save_output:
        out_path = output_path or str(
            PROJECT_ROOT / "data" / "evidence" / "face_demo_output.mp4"
        )
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(out_path, fourcc, fps_video, (width, height))
        print(f"[INFO] Saving output to: {out_path}")

    # ── Main loop ────────────────────────────────────────────────────────
    frame_idx = 0
    fps_samples: list[float] = []
    total_intrusion_events = 0
    total_face_matches = 0
    total_unknown_faces = 0
    t_loop_start = time.perf_counter()

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            t_frame_start = time.perf_counter()

            # ── Step 1: Track ────────────────────────────────────────────
            result = tracker.track(frame, frame_index=frame_idx)
            timestamp = time.time()

            # ── Step 2: Fence check ──────────────────────────────────────
            fence_events = fence.check(result.tracked_objects, timestamp=timestamp)
            total_intrusion_events += len(fence_events)

            for evt in fence_events:
                severity_icon = {
                    "low": "🟢", "medium": "🟡", "high": "🟠", "critical": "🔴",
                }.get(evt.severity, "⚪")
                print(
                    f"  {severity_icon} INTRUSION | "
                    f"Track ID:{evt.track_id} ({evt.class_name}) → "
                    f"Zone: {evt.zone_name} [{evt.severity.upper()}]"
                )

            # ── Step 3: Face recognition ─────────────────────────────────
            face_matches = recognizer.recognize_frame(frame, result.tracked_objects)

            for fm in face_matches:
                if fm.is_known:
                    total_face_matches += 1
                    print(
                        f"  🟢 FACE MATCH | "
                        f"Track ID:{fm.person_track_id} → "
                        f"\"{fm.name}\" (similarity: {fm.confidence:.3f})"
                    )
                else:
                    total_unknown_faces += 1
                    if frame_idx % 30 == 0:  # Don't spam unknowns
                        print(
                            f"  🔴 UNKNOWN FACE | "
                            f"Track ID:{fm.person_track_id} "
                            f"(det_score: {fm.det_score:.2f})"
                        )

            t_frame_end = time.perf_counter()
            frame_total_ms = (t_frame_end - t_frame_start) * 1000

            # ── Annotate ─────────────────────────────────────────────────
            annotated = frame.copy()

            # Layer 1: Fence zones
            if fence.zones:
                annotated = VirtualFence.draw_zones(annotated, fence.zones, alpha=0.2)

            # Layer 2: Tracked objects
            annotated = Tracker.draw_tracks(annotated, result.tracked_objects)

            # Layer 3: Face matches
            annotated = FaceRecognizer.draw_face_matches(annotated, face_matches)

            # HUD overlay
            fps_instant = 1000.0 / frame_total_ms if frame_total_ms > 0 else 0
            fps_samples.append(fps_instant)

            hud_line1 = (
                f"Frame {frame_idx:>5d} | "
                f"Tracks: {result.active_track_count:>2d} | "
                f"Faces: {len(face_matches):>2d} | "
                f"Total: {frame_total_ms:>6.1f}ms | "
                f"FPS: {fps_instant:>5.1f}"
            )
            cv2.putText(
                annotated, hud_line1, (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2, cv2.LINE_AA,
            )

            # Stats line
            stats_hud = (
                f"Known: {total_face_matches}  "
                f"Unknown: {total_unknown_faces}  "
                f"Intrusions: {total_intrusion_events}"
            )
            cv2.putText(
                annotated, stats_hud, (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 200, 200), 2, cv2.LINE_AA,
            )

            # Console output every 30 frames
            if frame_idx % 30 == 0:
                print(f"  {hud_line1}")

            # Save or display
            if writer:
                writer.write(annotated)
            else:
                cv2.imshow("IBVAP Tracking + Face Recognition Demo", annotated)
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q") or key == 27:
                    print("\n[INFO] User quit.")
                    break

            frame_idx += 1

    except KeyboardInterrupt:
        print("\n[INFO] Interrupted.")

    finally:
        t_total = time.perf_counter() - t_loop_start
        cap.release()
        if writer:
            writer.release()
        try:
            cv2.destroyAllWindows()
        except cv2.error:
            pass

    # ── Summary ──────────────────────────────────────────────────────────
    avg_fps = sum(fps_samples) / len(fps_samples) if fps_samples else 0
    print(f"\n{'='*60}")
    print(f"  Frames processed   : {frame_idx}")
    print(f"  Total wall time    : {t_total:.2f}s")
    print(f"  Average FPS        : {avg_fps:.1f}")
    print(f"  Throughput FPS     : {frame_idx / t_total:.1f}" if t_total > 0 else "")
    print(f"  Known face matches : {total_face_matches}")
    print(f"  Unknown faces      : {total_unknown_faces}")
    print(f"  Intrusion alerts   : {total_intrusion_events}")
    print(f"  Gallery persons    : {recognizer.gallery_size}")
    print(f"{'='*60}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="IBVAP Tracking + Face Recognition Demo",
    )
    parser.add_argument(
        "--video", type=str, default=None,
        help="Path to input video (overrides config)",
    )
    parser.add_argument(
        "--gallery", type=str, default=None,
        help="Path to face gallery directory (overrides config)",
    )
    parser.add_argument(
        "--threshold", type=float, default=None,
        help="Face similarity threshold (overrides config, default 0.6)",
    )
    parser.add_argument(
        "--config", type=str, default=None,
        help="Path to settings.yaml",
    )
    parser.add_argument(
        "--save", action="store_true",
        help="Save annotated video instead of displaying",
    )
    parser.add_argument(
        "--output", type=str, default=None,
        help="Output video path (used with --save)",
    )
    args = parser.parse_args()

    # Load config
    config = load_config(Path(args.config) if args.config else None)
    detection_config = config.get("detection", {})
    fence_config = config.get("fence", {})
    face_config = config.get("face", {})

    # Merge tracking-specific config into detection config
    tracking_config = config.get("tracking", {})
    detection_config.update(tracking_config)

    # Apply CLI overrides to face config
    if args.gallery:
        face_config["gallery_path"] = args.gallery
    if args.threshold is not None:
        face_config["similarity_threshold"] = args.threshold

    # Resolve video path
    video_path = args.video or config.get("video", {}).get("source", "data/videos/test.mp4")
    video_path_resolved = Path(video_path)
    if not video_path_resolved.is_absolute():
        video_path_resolved = PROJECT_ROOT / video_path_resolved

    if not video_path_resolved.exists():
        print(f"[ERROR] Video file not found: {video_path_resolved}")
        print(f"[HINT] Place a test video at: {PROJECT_ROOT / 'data' / 'videos' / 'test.mp4'}")
        sys.exit(1)

    run_demo(
        video_path=str(video_path_resolved),
        detection_config=detection_config,
        fence_config=fence_config,
        face_config=face_config,
        save_output=args.save,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
