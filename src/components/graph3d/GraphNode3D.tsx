import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { GraphNode } from "../../lib/types";
import { getNodeColor, INK, INK_MUTED, INK_FAINT } from "../../lib/colors";
import { nodeRadius } from "./useForceLayout";
import type { NodePosition3D } from "./useForceLayout";

interface Props {
  node: GraphNode;
  pos: NodePosition3D;
  dimmed: boolean;
  isSelected: boolean;
  isActive: boolean;
  onNodeClick: (node: GraphNode) => void;
  onNodeHover: (node: GraphNode | null) => void;
}

export function GraphNode3D({ node, pos, dimmed, isSelected, isActive, onNodeClick, onNodeHover }: Props) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const scaleRef = useRef(1);
  const color = getNodeColor(node.scope, node.project);
  const r = nodeRadius(node.fileSize);

  const subtitle = (node.scope === "project" ? node.project : node.scope) +
    (node.author !== "team" ? ` \u00B7 ${node.author}` : "");

  // Titles read "Project \u2014 Descriptor", but the project already appears in the
  // subtitle below. Drop the redundant prefix so the uppercase label keeps its
  // meaningful half instead of truncating into it.
  const displayName = node.name.replace(/^[^\u2014]+\u2014\s*/, "").trim() || node.name;

  const targetScale = hovered ? 1.25 : 1;
  useFrame(() => {
    scaleRef.current += (targetScale - scaleRef.current) * 0.15;
    if (meshRef.current) {
      meshRef.current.scale.setScalar(scaleRef.current);
    }
  });

  function handlePointerOver(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    setHovered(true);
    onNodeHover(node);
    document.body.style.cursor = "pointer";
  }

  function handlePointerOut(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    setHovered(false);
    onNodeHover(null);
    document.body.style.cursor = "";
  }

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onNodeClick(node);
  }

  const active = isSelected || hovered || isActive;

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      {isSelected && (
        <mesh>
          <ringGeometry args={[r + 3, r + 4.5, 48]} />
          <meshBasicMaterial color={color} opacity={0.6} transparent />
        </mesh>
      )}

      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <circleGeometry args={[r, 32]} />
        <meshBasicMaterial
          color={color}
          opacity={dimmed ? 0.1 : active ? 1 : 0.7}
          transparent={dimmed || !active}
        />
      </mesh>

      <Html
        position={[r + 11, 0, 0]}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          opacity: dimmed ? 0.12 : 1,
          transition: "opacity 0.2s",
        }}
        occlude={false}
      >
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          fontWeight: 700,
          color: active ? INK : INK_MUTED,
          whiteSpace: "nowrap",
          lineHeight: 1.25,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          transition: "color 0.15s",
          WebkitFontSmoothing: "antialiased",
        }}>
          {displayName.length > 30 ? displayName.slice(0, 28) + "\u2026" : displayName}
        </div>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: 10,
          fontWeight: 500,
          color: INK_FAINT,
          whiteSpace: "nowrap",
          letterSpacing: "0.02em",
          marginTop: 1,
          WebkitFontSmoothing: "antialiased",
        }}>
          {subtitle}
        </div>
      </Html>
    </group>
  );
}
