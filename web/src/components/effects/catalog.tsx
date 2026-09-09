import { Balatro } from './Balatro';
import { ClickSpark } from './ClickSpark';
import { CountUp } from './CountUp';
import { DecryptedText } from './DecryptedText';
import { ElectricBorder } from './ElectricBorder';
import { FaultyTerminal } from './FaultyTerminal';
import { GlitchText } from './GlitchText';
import { GradientText } from './GradientText';
import { LetterGlitch } from './LetterGlitch';
import { Magnet } from './Magnet';
import { Noise } from './Noise';
import { ScrambledText } from './ScrambledText';
import { ShinyText } from './ShinyText';
import { StarBorder } from './StarBorder';

// Catalog for the effects playground on /glass-test. Each entry renders one
// adapted react-bits component with default (or demo-minimal) props so its
// look can be evaluated before promoting it into the app proper.

export type EffectCategory = 'text' | 'animation' | 'background';

export interface EffectEntry {
  id: string;
  name: string;
  category: EffectCategory;
  node: JSX.Element;
}

export const EFFECT_CATALOG: EffectEntry[] = [
  {
    id: 'decrypted',
    name: 'Decrypted Text',
    category: 'text',
    node: <DecryptedText text="KR8BIT" animateOn="view" sequential />,
  },
  {
    id: 'scrambled',
    name: 'Scrambled Text',
    category: 'text',
    node: <ScrambledText>Move the pointer across this line</ScrambledText>,
  },
  {
    id: 'glitch',
    name: 'Glitch Text',
    category: 'text',
    node: (
      <GlitchText enableOnHover={false}>KR8BIT</GlitchText>
    ),
  },
  {
    id: 'countup',
    name: 'Count Up',
    category: 'text',
    node: <CountUp to={1337} className="glass-test-effect-big" />,
  },
  {
    id: 'shiny',
    name: 'Shiny Text',
    category: 'text',
    node: <ShinyText text="SHINY TEXT" />,
  },
  {
    id: 'gradient',
    name: 'Gradient Text',
    category: 'text',
    node: <GradientText>GRADIENT</GradientText>,
  },
  {
    id: 'clickspark',
    name: 'Click Spark',
    category: 'animation',
    node: (
      <ClickSpark>
        <div className="glass-test-effect-fill">
          <span className="glass-test-effect-hint">click anywhere in this tile</span>
        </div>
      </ClickSpark>
    ),
  },
  {
    id: 'starborder',
    name: 'Star Border',
    category: 'animation',
    node: <StarBorder>STAR BADGE</StarBorder>,
  },
  {
    id: 'electricborder',
    name: 'Electric Border',
    category: 'animation',
    node: <ElectricBorder><div className="glass-test-effect-pad">ELECTRIC</div></ElectricBorder>,
  },
  {
    id: 'magnet',
    name: 'Magnet',
    category: 'animation',
    node: (
      <Magnet>
        <button type="button" className="glass-test-btn">
          move pointer near
        </button>
      </Magnet>
    ),
  },
  {
    id: 'noise',
    name: 'Noise',
    category: 'animation',
    node: (
      <>
        <span className="glass-test-effect-hint">film grain</span>
        <Noise />
      </>
    ),
  },
  {
    id: 'letterglitch',
    name: 'Letter Glitch',
    category: 'background',
    node: <LetterGlitch />,
  },
  {
    id: 'balatro',
    name: 'Balatro',
    category: 'background',
    node: <Balatro />,
  },
  {
    id: 'faultyterminal',
    name: 'Faulty Terminal',
    category: 'background',
    node: <FaultyTerminal />,
  },
];
