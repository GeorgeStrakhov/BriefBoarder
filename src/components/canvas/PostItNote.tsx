import { useRef, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';

interface PostItNoteProps {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  rotation: number;
  scaleX: number;
  scaleY: number;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  onDoubleClick: () => void;
  nodeRef: (node: Konva.Group | null) => void;
}

export default function PostItNote({
  x,
  y,
  width,
  height,
  text,
  rotation,
  scaleX,
  scaleY,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
  nodeRef,
}: PostItNoteProps) {
  const groupRef = useRef<Konva.Group>(null);

  useEffect(() => {
    if (groupRef.current && nodeRef) {
      nodeRef(groupRef.current);
    }
  }, [nodeRef]);

  return (
    <Group
      ref={groupRef}
      x={x}
      y={y}
      rotation={rotation}
      scaleX={scaleX}
      scaleY={scaleY}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
    >
      {/* Yellow sticky note background */}
      <Rect
        width={width}
        height={height}
        fill="#FEFF9C"
        stroke={isSelected ? '#0066ff' : '#E5E5A0'}
        strokeWidth={isSelected ? 2 : 1}
        shadowColor="black"
        shadowBlur={10}
        shadowOffsetX={5}
        shadowOffsetY={5}
        shadowOpacity={0.3}
        cornerRadius={4}
      />
      {/* Text content */}
      <Text
        text={text || 'Double-click to edit'}
        fontSize={16}
        fontFamily="Arial"
        fill={text ? '#333' : '#999'}
        fontStyle={text ? 'normal' : 'italic'}
        width={width}
        height={height}
        padding={15}
        align="left"
        verticalAlign="top"
        wrap="word"
      />
    </Group>
  );
}
