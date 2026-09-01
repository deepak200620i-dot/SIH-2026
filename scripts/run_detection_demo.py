"""
IBVAP — Detection Demo Script
===============================
Opens a video file, runs YOLO26n detection per frame, displays annotated
output, and reports FPS.

Usage:
    python scripts/run_detection_demo.py
    python scripts/run_detection_demo.py --video path/to/video.mp4
    python scripts/run_detection_demo.py --save   # saves output video instead of displaying
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

from src.detection.detector import Detector


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
    save_output: bool = False,
    output_path: str | None = None,
) -> None:
    """Run the detection demo on a video file."""

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

    # ── Initialize detector ──────────────────────────────────────────────
    detector = Detector(detection_config)
    print("[INFO] Warming up YOLO model...")
    detector.warmup()
    print("[INFO] Model ready. Starting detection...\n")

    # ── Optional: video writer for saving output ─────────────────────────
    writer = None
    if save_output:
        out_path = output_path or str(PROJECT_ROOT / "data" / "evidence" / "demo_output.mp4")
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(out_path, fourcc, fps_video, (width, height))
        print(f"[INFO] Saving output to: {out_path}")

    # ── Main loop ────────────────────────────────────────────────────────
    frame_idx = 0
    fps_samples: list[float] = []
    t_loop_start = time.perf_counter()

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Detect
            result = detector.detect(frame, frame_index=frame_idx)

            # Annotate
            annotated = Detector.draw_detections(frame, result.detections)

            # HUD overlay — show FPS + detection count
            fps_instant = 1000.0 / result.total_ms if result.total_ms > 0 else 0
            fps_samples.append(fps_instant)
            hud = (
                f"Frame {frame_idx:>5d} | "
                f"Detections: {len(result.detections):>2d} | "
                f"Infer: {result.inference_ms:>6.1f}ms | "
                f"Total: {result.total_ms:>6.1f}ms | "
                f"FPS: {fps_instant:>5.1f}"
            )
            cv2.putText(
                annotated, hud, (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2, cv2.LINE_AA,
            )

            # Print to console every 30 frames
            if frame_idx % 30 == 0:
                det_summary = ", ".join(
                    f"{d.class_name}({d.confidence:.2f})" for d in result.detections[:5]
                )
                if len(result.detections) > 5:
                    det_summary += f" ... +{len(result.detections) - 5} more"
                print(f"  {hud}  [{det_summary}]")

            # Save or display
            if writer:
                writer.write(annotated)
            else:
                cv2.imshow("IBVAP Detection Demo", annotated)
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q") or key == 27:  # q or ESC
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
        cv2.destroyAllWindows()

    # ── Summary ──────────────────────────────────────────────────────────
    avg_fps = sum(fps_samples) / len(fps_samples) if fps_samples else 0
    print(f"\n{'='*60}")
    print(f"  Frames processed : {frame_idx}")
    print(f"  Total wall time  : {t_total:.2f}s")
    print(f"  Average FPS      : {avg_fps:.1f}")
    print(f"  Throughput FPS   : {frame_idx / t_total:.1f}" if t_total > 0 else "")
    print(f"{'='*60}")


def main() -> None:
    parser = argparse.ArgumentParser(description="IBVAP YOLO26n Detection Demo")
    parser.add_argument("--video", type=str, default=None, help="Path to input video (overrides config)")
    parser.add_argument("--config", type=str, default=None, help="Path to settings.yaml")
    parser.add_argument("--save", action="store_true", help="Save annotated video instead of displaying")
    parser.add_argument("--output", type=str, default=None, help="Output video path (used with --save)")
    args = parser.parse_args()

    # Load config
    config = load_config(Path(args.config) if args.config else None)
    detection_config = config.get("detection", {})

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
        save_output=args.save,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
