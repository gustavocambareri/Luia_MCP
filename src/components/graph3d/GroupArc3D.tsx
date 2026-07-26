import { useMemo } from "react";
import { Line, Html } from "@react-three/drei";
import { EllipseCurve, Vector3 } from "three";
import { RING_RADIUS, GROUP_LABELS } from "./useRingLayout";
import type { GroupArc3D as GroupArc3DType } from "./useRingLayout";

interface Props {
  arc: GroupArc3DType;
}

const ARC_OFFSET = 28;
const LABEL_OFFSET = 52;

export function GroupArc3D({ arc }: Props) {
  const { points, labelPos, mid, isLeft } = useMemo(() => {
    const curve = new EllipseCurve(
      0, 0,
      RING_RADIUS + ARC_OFFSET, RING_RADIUS + ARC_OFFSET,
      arc.startAngle, arc.endAngle,
      false, 0
    );
    const pts2d = curve.getPoints(64);
    const pts = pts2d.map(p => new Vector3(p.x, p.y, 0));

    const midAngle = (arc.startAngle + arc.endAngle) / 2;
    const labelDist = RING_RADIUS + ARC_OFFSET + LABEL_OFFSET;
    const lPos = new Vector3(
      Math.cos(midAngle) * labelDist,
      Math.sin(midAngle) * labelDist,
      0
    );
    const left = Math.cos(midAngle) < 0;

    return { points: pts, labelPos: lPos, mid: midAngle, isLeft: left };
  }, [arc]);

  // suppress unused warning
  void mid;

  return (
    <group>
      <Line
        points={points}
        color={arc.color}
        lineWidth={2}
        transparent
        opacity={0.25}
      />
      <Html
        position={[labelPos.x, labelPos.y, labelPos.z]}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          textAlign: isLeft ? "right" : "left",
          transform: isLeft ? "translateX(-100%)" : "none",
        }}
        occlude={false}
      >
        <div style={{
          fontFamily: "Pantasia, serif",
          fontSize: 11,
          fontWeight: 700,
          color: arc.color,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          whiteSpace: "nowrap",
          textShadow: "0 0 4px rgba(244,242,237,0.95), 0 0 8px rgba(244,242,237,0.95)",
        }}>
          {GROUP_LABELS[arc.key] ?? arc.key}
        </div>
      </Html>
    </group>
  );
}
