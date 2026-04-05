import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { GraphNode } from "../../lib/types";
import { getNodeColor } from "../../lib/colors";
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
        position={[r + 8, 0, 0]}
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
          fontSize: 10,
          fontWeight: 500,
          color: active ? "#2D3748" : "#8A95A3",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
          letterSpacing: "0.02em",
          transition: "color 0.15s",
          WebkitFontSmoothing: "antialiased",
        }}>
          {node.name.length > 28 ? node.name.slice(0, 26) + "\u2026" : node.name}
        </div>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: 8,
          fontWeight: 400,
          color: "#B0B8C4",
          whiteSpace: "nowrap",
          letterSpacing: "0.02em",
          WebkitFontSmoothing: "antialiased",
        }}>
          {subtitle}
        </div>
      </Html>
    </group>
  );
}
