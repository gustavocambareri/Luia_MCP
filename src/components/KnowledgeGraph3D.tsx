import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MOUSE } from "three";
import * as THREE from "three";
import type { GraphNode, GraphEdge } from "../lib/types";
import { useForceLayout } from "./graph3d/useForceLayout";
import type { NodePosition3D } from "./graph3d/useForceLayout";
import { GraphNode3D } from "./graph3d/GraphNode3D";
import { GraphEdge3D } from "./graph3d/GraphEdge3D";

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  isNodeDimmed: (id: string) => boolean;
  onNodeClick: (node: GraphNode) => void;
  onNodeHover: (node: GraphNode | null) => void;
  onDeselect: () => void;
  selectedNodeId: string | null;
  highlightedNodeIds: Set<string>;
}

export function KnowledgeGraph3D(props: Props) {
  return (
    <Canvas
      style={{ position: "absolute", inset: 0 }}
      camera={{ position: [0, 0, 800], fov: 45, near: 1, far: 3000 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      onPointerMissed={() => props.onDeselect()}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}

function FitCamera({ positions }: { positions: Map<string, NodePosition3D> }) {
  const { camera, size } = useThree();
  const fitted = useRef(false);

  useEffect(() => {
    if (positions.size === 0 || fitted.current) return;
    fitted.current = true;

    let maxX = 0;
    let maxY = 0;
    for (const pos of positions.values()) {
      maxX = Math.max(maxX, Math.abs(pos.x));
      maxY = Math.max(maxY, Math.abs(pos.y));
    }

    maxX += 120;
    maxY += 40;

    const fov = (camera as THREE.PerspectiveCamera).fov;
    const aspect = size.width / size.height;
    const fovRad = (fov * Math.PI) / 180;

    const zForHeight = maxY / Math.tan(fovRad / 2);
    const zForWidth = maxX / (aspect * Math.tan(fovRad / 2));
    const z = Math.max(zForHeight, zForWidth) * 1.1;

    camera.position.set(0, 0, z);
    camera.updateProjectionMatrix();
  }, [positions, camera, size]);

  return null;
}

function SceneContent({
  nodes,
  edges,
  isNodeDimmed,
  onNodeClick,
  onNodeHover,
  selectedNodeId,
  highlightedNodeIds,
}: Props) {
  const { positions } = useForceLayout(nodes);

  return (
    <>
      <FitCamera positions={positions} />

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        zoomSpeed={0.8}
        enableRotate={false}
        mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN }}
        makeDefault
      />

      {edges.map((edge, i) => {
        const isActive = selectedNodeId !== null &&
          (edge.source === selectedNodeId || edge.target === selectedNodeId);
        const isHighlightActive = !selectedNodeId && (
          highlightedNodeIds.has(edge.source) || highlightedNodeIds.has(edge.target)
        );
        const active = isActive || isHighlightActive;
        const anyActive = selectedNodeId !== null || highlightedNodeIds.size > 0;
        const dimmed = isNodeDimmed(edge.source) && isNodeDimmed(edge.target);

        return (
          <GraphEdge3D
            key={`${edge.source}-${edge.target}-${i}`}
            edge={edge}
            positions={positions}
            nodes={nodes}
            active={active}
            anyActive={anyActive}
            dimmed={dimmed}
          />
        );
      })}

      {nodes.map(node => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        const dimmed = isNodeDimmed(node.id);
        const isSelected = node.id === selectedNodeId;
        const isActive = highlightedNodeIds.has(node.id);

        return (
          <GraphNode3D
            key={node.id}
            node={node}
            pos={pos}
            dimmed={dimmed}
            isSelected={isSelected}
            isActive={isActive}
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
          />
        );
      })}
    </>
  );
}
