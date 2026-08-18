import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fonts } from '../theme';
import { IntroDoodle } from './IntroDoodle';

export type IntroCardTone = 'sky' | 'coral' | 'gold';

export type IntroCardData = {
  label: string;
  title: string;
  body: string;
  card: IntroCardTone;
};

export const CARD_COLORS: Record<IntroCardTone, string> = {
  sky: '#FF9A3C',
  coral: '#6B91FF',
  gold: '#FEC554',
};

const SLOT = [
  { x: 0, y: 0, rotate: 0, scale: 1, z: 3 },
  { x: 10, y: 8, rotate: 4.32, scale: 1, z: 2 },
  { x: -12, y: 14, rotate: -7.214, scale: 1, z: 1 },
] as const;

export const INTRO_STAGE_H = 340;
export const INTRO_CARD_SIZE = 300;
export const INTRO_CARD_TOP_INSET = (INTRO_STAGE_H - INTRO_CARD_SIZE) / 2;

const STAGE_ID = 'intro-cards-stage';

type Anim = {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
};

function makeAnim(slotIndex: number): Anim {
  const slot = SLOT[slotIndex];
  return {
    x: new Animated.Value(slot.x),
    y: new Animated.Value(slot.y),
    rotate: new Animated.Value(slot.rotate),
    scale: new Animated.Value(slot.scale),
  };
}

type Props = {
  slides: IntroCardData[];
  index: number;
  onNext: () => void;
  onPrev: () => void;
  interactive?: boolean;
};

export function StackedIntroCards({
  slides,
  index,
  onNext,
  onPrev,
  interactive = true,
}: Props) {
  const order = useMemo(() => slides.map((s) => s.card), [slides]);
  const anims = useRef(order.map((_, i) => makeAnim(i))).current;
  const contentFade = useRef(new Animated.Value(1)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const onNextRef = useRef(onNext);
  const onPrevRef = useRef(onPrev);
  const interactiveRef = useRef(interactive);
  onNextRef.current = onNext;
  onPrevRef.current = onPrev;
  interactiveRef.current = interactive;

  const didInit = useRef(false);

  useEffect(() => {
    const snapOrSpring = order.map((_, toneIndex) => {
      const slotIndex = (toneIndex - index + order.length) % order.length;
      const slot = SLOT[slotIndex];
      const anim = anims[toneIndex];
      if (!didInit.current) {
        anim.x.setValue(slot.x);
        anim.y.setValue(slot.y);
        anim.rotate.setValue(slot.rotate);
        anim.scale.setValue(slot.scale);
        return null;
      }
      return Animated.parallel([
        Animated.spring(anim.x, {
          toValue: slot.x,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(anim.y, {
          toValue: slot.y,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(anim.rotate, {
          toValue: slot.rotate,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(anim.scale, {
          toValue: slot.scale,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]);
    });

    if (!didInit.current) {
      didInit.current = true;
      contentFade.setValue(1);
      dragX.setValue(0);
      return;
    }

    contentFade.setValue(0);
    dragX.setValue(0);
    Animated.parallel([
      Animated.parallel(snapOrSpring.filter(Boolean) as Animated.CompositeAnimation[]),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [anims, contentFade, dragX, index, order]);

  const stageNode = useRef<HTMLElement | null>(null);

  // Web: bind to the real DOM node. Parent transforms (BubbleEnter) steal RN responders.
  useEffect(() => {
    if (Platform.OS !== 'web' || !interactive) return;

    let tries = 0;
    let remove: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const attach = (el: HTMLElement) => {
      const onDown = (e: PointerEvent) => {
        if (!interactiveRef.current) return;
        tracking.current = true;
        startX.current = e.clientX;
        startY.current = e.clientY;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        el.style.cursor = 'grabbing';
      };
      const onMove = (e: PointerEvent) => {
        if (!tracking.current) return;
        e.preventDefault();
        dragX.setValue((e.clientX - startX.current) * 0.4);
      };
      const onUp = (e: PointerEvent) => {
        if (!tracking.current) return;
        tracking.current = false;
        el.style.cursor = 'grab';
        const dx = e.clientX - startX.current;
        const dy = e.clientY - startY.current;
        Animated.spring(dragX, {
          toValue: 0,
          friction: 7,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
        if (!interactiveRef.current) return;
        if (dx > 40) onPrevRef.current();
        else if (Math.abs(dx) < 14 && Math.abs(dy) < 14) onNextRef.current();
        else if (dx < -40) onNextRef.current();
      };

      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove, { passive: false });
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.style.cursor = 'grab';
      el.style.touchAction = 'none';
      el.style.userSelect = 'none';
      el.style.pointerEvents = 'auto';

      return () => {
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
      };
    };

    const tryAttach = () => {
      const host =
        stageNode.current ??
        (typeof document !== 'undefined'
          ? document.getElementById(STAGE_ID)
          : null);
      if (host) {
        remove = attach(host);
        return;
      }
      if (tries++ < 20) {
        timer = setTimeout(tryAttach, 50);
      }
    };
    tryAttach();

    return () => {
      if (timer) clearTimeout(timer);
      remove?.();
    };
  }, [dragX, interactive]);

  const active = slides[index];

  return (
    <View
      ref={(node) => {
        stageNode.current = node as unknown as HTMLElement | null;
      }}
      nativeID={STAGE_ID}
      {...(Platform.OS === 'web' ? ({ id: STAGE_ID } as object) : null)}
      collapsable={false}
      style={styles.stage}
      pointerEvents={interactive ? 'auto' : 'none'}
      onStartShouldSetResponder={() => interactive}
      onMoveShouldSetResponder={() => interactive}
      onResponderGrant={(e) => {
        if (!interactive) return;
        tracking.current = true;
        startX.current = e.nativeEvent.pageX;
        startY.current = e.nativeEvent.pageY;
      }}
      onResponderMove={(e) => {
        if (!tracking.current) return;
        dragX.setValue((e.nativeEvent.pageX - startX.current) * 0.4);
      }}
      onResponderRelease={(e) => {
        if (!tracking.current) return;
        tracking.current = false;
        const dx = e.nativeEvent.pageX - startX.current;
        const dy = e.nativeEvent.pageY - startY.current;
        Animated.spring(dragX, {
          toValue: 0,
          friction: 7,
          useNativeDriver: true,
        }).start();
        if (dx > 40) onPrevRef.current();
        else if (Math.abs(dx) < 14 && Math.abs(dy) < 14) onNextRef.current();
        else if (dx < -40) onNextRef.current();
      }}
    >
      {order.map((tone, toneIndex) => {
        const anim = anims[toneIndex];
        const slotIndex = (toneIndex - index + order.length) % order.length;
        const rotate = anim.rotate.interpolate({
          inputRange: [-20, 20],
          outputRange: ['-20deg', '20deg'],
        });
        const isFront = slotIndex === 0;

        return (
          <Animated.View
            key={tone}
            pointerEvents="none"
            style={[
              styles.card,
              {
                backgroundColor: CARD_COLORS[tone],
                zIndex: SLOT[slotIndex].z,
                transform: [
                  { translateX: isFront ? Animated.add(anim.x, dragX) : anim.x },
                  { translateY: anim.y },
                  { rotate },
                  { scale: anim.scale },
                ],
              },
            ]}
          >
            {isFront ? (
              <Animated.View style={[styles.copy, { opacity: contentFade }]}>
                <Text style={styles.body}>{active.body}</Text>
                <View style={styles.doodle}>
                  <IntroDoodle tone={tone} />
                </View>
              </Animated.View>
            ) : (
              <View style={styles.copy} />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    height: INTRO_STAGE_H,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  card: {
    position: 'absolute',
    width: INTRO_CARD_SIZE,
    height: INTRO_CARD_SIZE,
    borderRadius: 24,
    borderWidth: 0,
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  body: {
    fontFamily: fonts.headingRegular,
    fontSize: 27,
    lineHeight: 31,
    letterSpacing: 0.2,
    color: '#1A1A1A',
    width: 240,
    ...(Platform.OS === 'web'
      ? ({ fontWeight: '400', fontSynthesis: 'none' } as object)
      : { fontWeight: '400' as const }),
  },
  doodle: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
});
