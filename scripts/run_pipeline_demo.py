"""
IBVAP — Unified Pipeline Demo Script (Step 6)
==============================================
Runs the full IBVAP VideoPipeline: YOLO26n tracking, Virtual Fence, Loitering,
InsightFace Face Recognition, and EasyOCR ANPR.

Usage:
    python scripts/run_pipeline_demo.py
    python scripts/run_pipeline_demo.py --video path/to/video.mp4
    python scripts/run_pipeline_demo.py --save
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

from src.pipeline.video_pipeline import VideoPipeline


def load_config(config_path: Path | None = None) -> dict:
    """Load settings.yaml from the config directory."""
    path = config_path or (PROJECT_ROOT / "config" / "settings.yaml")
    if not path.exists():
        print(f"[ERROR] Config not found: {path}")
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def run_demo(
    video_path: str,
    config: dict,
    enable_face: bool = True,
    enable_anpr: bool = True,
    save_output: bool = False,
    output_path: str | None = None,
) -> None:
    """Run the unified video pipeline demo on a video file."""
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

    print("[INFO] Initializing VideoPipeline...")
    pipeline = VideoPipeline(config=config, enable_face=enable_face, enable_anpr=enable_anpr)
    print("[INFO] Pipeline ready. Processing frames...\n")

    writer = None
    if save_output:
        out_path = output_path or str(
            PROJECT_ROOT / "data" / "evidence" / "pipeline_demo_output.mp4"
        )
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(out_path, fourcc, fps_video, (width, height))
        print(f"[INFO] Saving output to: {out_path}")

    frame_idx = 0
    fps_samples: list[float] = []
    total_events = 0
    t_loop_start = time.perf_counter()

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            result = pipeline.process_frame(frame, frame_index=frame_idx, timestamp=time.time())
            total_events += len(result.generated_events)
            fps_samples.append(result.fps)

            # Print generated events
            for evt in result.generated_events:
                icon = {
                    "low": "🟢",
                    "medium": "🟡",
                    "high": "🟠",
                    "critical": "🔴",
                }.get(evt.severity, "⚪")
                print(
                    f"  {icon} [{evt.severity.upper()}] {evt.event_type.upper()} | "
                    f"Camera: {evt.camera_id} | Track: {evt.track_id} | Class: {evt.class_name}"
                )

            annotated = result.annotated_frame if result.annotated_frame is not None else frame

            # HUD
            hud = (
                f"Frame {frame_idx:>5d} | "
                f"Tracks: {len(result.tracked_objects):>2d} | "
                f"Events: {total_events:>2d} | "
                f"Total: {result.total_ms:>6.1f}ms | "
                f"FPS: {result.fps:>5.1f}"
            )
            cv2.putText(
                annotated,
                hud,
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 255, 255),
                2,
                cv2.LINE_AA,
            )

            if frame_idx % 30 == 0:
                print(f"  {hud}")

            if writer:
                writer.write(annotated)
            else:
                cv2.imshow("IBVAP Unified Pipeline Demo", annotated)
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

    avg_fps = sum(fps_samples) / len(fps_samples) if fps_samples else 0
    print(f"\n{'='*60}")
    print(f"  Frames processed : {frame_idx}")
    print(f"  Total wall time  : {t_total:.2f}s")
    print(f"  Average FPS      : {avg_fps:.1f}")
    print(f"  Total events     : {total_events}")
    print(f"{'='*60}")


def main() -> None:
    parser = argparse.ArgumentParser(description="IBVAP Unified Pipeline Demo (Step 6)")
    parser.add_argument("--video", type=str, default=None, help="Path to input video")
    parser.add_argument("--config", type=str, default=None, help="Path to settings.yaml")
    parser.add_argument("--no-face", action="store_true", help="Disable face recognition stage")
    parser.add_argument("--no-anpr", action="store_true", help="Disable ANPR stage")
    parser.add_argument("--save", action="store_true", help="Save output video")
    parser.add_argument("--output", type=str, default=None, help="Output video path")
    args = parser.parse_args()

    config = load_config(Path(args.config) if args.config else None)
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
        config=config,
        enable_face=not args.no_face,
        enable_anpr=not args.no_anpr,
        save_output=args.save,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
