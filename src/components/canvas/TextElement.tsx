import { useRef, useEffect } from "react";
import { Text } from "react-konva";
import Konva from "konva";

interface TextElementProps {
  x: number;
  y: number;
  width: number;
  text: string;
  fontFamily: string;
  lineHeight: number;
  bold: boolean;
  italic: boolean;
  color: string;
  align: "left" | "center" | "right";
  shadow: boolean;
  rotation: number;
  scaleX: number;
  scaleY: number;
  isSelected: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSelect: (e: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDragEnd: (e: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onTransformEnd: (e: any) => void;
  onDoubleClick: () => void;
  nodeRef: (node: Konva.Text | null) => void;
}

export default function TextElement({
  x,
  y,
  width,
  text,
  fontFamily,
  lineHeight,
  bold,
  italic,
  color,
  align,
  shadow,
  rotation,
  scaleX,
  scaleY,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
  nodeRef,
}: TextElementProps) {
  const textRef = useRef<Konva.Text>(null);

  useEffect(() => {
    if (textRef.current && nodeRef) {
      nodeRef(textRef.current);
    }
  }, [nodeRef]);

  // Convert CSS var() to actual font family for Konva
  // Konva doesn't support CSS variables, so we extract the font family name
  const getActualFontFamily = (fontVar: string): string => {
    if (fontVar.includes("geist-sans")) return "Geist";
    if (fontVar.includes("inter")) return "Inter";
    if (fontVar.includes("playfair")) return "Playfair Display";
    if (fontVar.includes("bebas")) return "Bebas Neue";
    if (fontVar.includes("caveat")) return "Caveat";
    if (fontVar.includes("roboto-mono")) return "Roboto Mono";
    if (fontVar.includes("orbitron")) return "Orbitron";
    return "Geist"; // fallback
  };

  // Build font style string
  const getFontStyle = (): string => {
    const parts: string[] = [];
    if (italic) parts.push("italic");
    if (bold) parts.push("bold");
    return parts.join(" ");
  };

  return (
    <Text
      ref={textRef}
      x={x}
      y={y}
      text={text}
      fontSize={32} // Base size (user scales on canvas)
      fontFamily={getActualFontFamily(fontFamily)}
      fontStyle={getFontStyle()}
      fill={color}
      width={width}
      align={align}
      lineHeight={lineHeight}
      padding={10}
      rotation={rotation}
      scaleX={scaleX}
      scaleY={scaleY}
      wrap="word"
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      stroke={isSelected ? "#0066ff" : undefined}
      strokeWidth={isSelected ? 1 : 0}
      shadowColor={shadow ? "black" : undefined}
      shadowBlur={shadow ? 10 : 0}
      shadowOffsetX={shadow ? 5 : 0}
      shadowOffsetY={shadow ? 5 : 0}
      shadowOpacity={shadow ? 0.5 : 0}
    />
  );
}
