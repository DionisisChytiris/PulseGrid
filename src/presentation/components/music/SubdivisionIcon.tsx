import Svg, { Ellipse, G, Rect, Text as SvgText } from 'react-native-svg';

import { studioColors } from '../../theme';

export type SubdivisionIconType = 'quarter' | 'eighth' | 'triplet' | 'sixteenth';

type SubdivisionIconProps = {
  type: SubdivisionIconType;
  size?: number;
  color?: string;
};

const VIEWBOX = '0 0 48 40';

function NoteHead({
  cx,
  cy,
  color,
}: {
  cx: number;
  cy: number;
  color: string;
}) {
  return (
    <Ellipse
      cx={cx}
      cy={cy}
      rx={5.2}
      ry={3.7}
      fill={color}
      transform={`rotate(-28 ${cx} ${cy})`}
    />
  );
}

/** Vertical stem as a filled rect — more reliable than Line on RN SVG. */
function Stem({
  x,
  top,
  bottom,
  color,
  width = 1.9,
}: {
  x: number;
  top: number;
  bottom: number;
  color: string;
  width?: number;
}) {
  return (
    <Rect
      x={x - width / 2}
      y={top}
      width={width}
      height={Math.max(0, bottom - top)}
      fill={color}
    />
  );
}

function Beam({
  x1,
  x2,
  y,
  color,
  thickness = 3.2,
}: {
  x1: number;
  x2: number;
  y: number;
  color: string;
  thickness?: number;
}) {
  return <Rect x={x1} y={y} width={x2 - x1} height={thickness} rx={0.6} fill={color} />;
}

function QuarterNote({ color }: { color: string }) {
  return (
    <G>
      <Rect x={27} y={2} width={3.2} height={26} fill={color} />
      <Ellipse
        cx={25}
        cy={29}
        rx={6.2}
        ry={4.4}
        fill={color}
        transform="rotate(-25 21 29)"
      />
    </G>
  );
}

function EighthNotes({ color }: { color: string }) {
  const heads = [
    { cx: 14, cy: 30 },
    { cx: 34, cy: 30 },
  ];
  const stemTop = 6;
  const stems = heads.map((h) => h.cx + 4.4);

  return (
    <>
      {stems.map((x) => (
        <Stem key={x} x={x} top={stemTop} bottom={29} color={color} />
      ))}
      <Beam x1={stems[0]!} x2={stems[1]!} y={stemTop} color={color} />
      {heads.map((h) => (
        <NoteHead key={h.cx} cx={h.cx} cy={h.cy} color={color} />
      ))}
    </>
  );
}

function TripletNotes({ color }: { color: string }) {
  const heads = [
    { cx: 10, cy: 31 },
    { cx: 24, cy: 31 },
    { cx: 38, cy: 31 },
  ];
  const stemTop = 8;
  const stems = heads.map((h) => h.cx + 4.2);

  return (
    <>
      {stems.map((x) => (
        <Stem key={x} x={x} top={stemTop} bottom={30} color={color} />
      ))}
      <Beam x1={stems[0]!} x2={stems[2]!} y={stemTop} color={color} thickness={3} />
      {heads.map((h) => (
        <NoteHead key={h.cx} cx={h.cx} cy={h.cy} color={color} />
      ))}
      <SvgText
        x={29}
        y={3.5}
        fill={color}
        fontSize={9}
        fontWeight="700"
        textAnchor="middle"
      >
        3
      </SvgText>
    </>
  );
}

function SixteenthNotes({ color }: { color: string }) {
  const heads = [
    { cx: 8, cy: 31 },
    { cx: 18.5, cy: 31 },
    { cx: 29, cy: 31 },
    { cx: 39.5, cy: 31 },
  ];
  const stemTop = 5;
  const stems = heads.map((h) => h.cx + 4);
  const beamGap = 4.2;

  return (
    <>
      {stems.map((x) => (
        <Stem key={x} x={x} top={stemTop} bottom={30} color={color} />
      ))}
      <Beam x1={stems[0]!} x2={stems[3]!} y={stemTop} color={color} thickness={2.6} />
      <Beam
        x1={stems[0]!}
        x2={stems[3]!}
        y={stemTop + beamGap}
        color={color}
        thickness={2.6}
      />
      {heads.map((h) => (
        <NoteHead key={h.cx} cx={h.cx} cy={h.cy} color={color} />
      ))}
    </>
  );
}

export function SubdivisionIcon({
  type,
  size = 28,
  color = studioColors.textPrimary,
}: SubdivisionIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={VIEWBOX}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {type === 'quarter' && <QuarterNote color={color} />}
      {type === 'eighth' && <EighthNotes color={color} />}
      {type === 'triplet' && <TripletNotes color={color} />}
      {type === 'sixteenth' && <SixteenthNotes color={color} />}
    </Svg>
  );
}
