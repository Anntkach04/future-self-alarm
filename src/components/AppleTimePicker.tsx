import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  InputAccessoryView,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { playPickerTick } from '../services/pickerTick';
import { accents, colors, fonts, inkStroke, noFakeBold } from '../theme';

const TIME_ACCESSORY_ID = 'future-self-time-input';
/** Many copies so edges feel endless; we recenter to the middle band. */
const LOOP_COPIES = 20;

function clampPart(n: number, max: number) {
  if (Number.isNaN(n)) return 0;
  return Math.min(max, Math.max(0, n));
}

export function parseUnifiedTime(
  raw: string,
  fallbackHour: number,
  fallbackMinute: number
) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }

  if (trimmed.includes(':')) {
    const [hPart, mPart = ''] = trimmed.split(':');
    return {
      hour: clampPart(parseInt(hPart.replace(/\D/g, '') || '0', 10), 23),
      minute: clampPart(parseInt(mPart.replace(/\D/g, '') || '0', 10), 59),
    };
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits.length) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }
  if (digits.length <= 2) {
    return {
      hour: clampPart(parseInt(digits, 10), 23),
      minute: fallbackMinute,
    };
  }
  if (digits.length === 3) {
    return {
      hour: clampPart(parseInt(digits[0]!, 10), 23),
      minute: clampPart(parseInt(digits.slice(1), 10), 59),
    };
  }
  return {
    hour: clampPart(parseInt(digits.slice(0, 2), 10), 23),
    minute: clampPart(parseInt(digits.slice(2, 4), 10), 59),
  };
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

type WheelProps = {
  values: number[];
  value: number;
  onChange: (value: number) => void;
  onTap?: () => void;
  accessibilityLabel: string;
  itemH: number;
  pad: number;
  visible: number;
  scrollEnabled: boolean;
};

/**
 * Infinite wheel: … 58, 59, 00, 01 … / … 22, 23, 00, 01 …
 * No top/bottom stop — list is repeated and recentered to the middle copy.
 */
function WheelColumn({
  values,
  value,
  onChange,
  onTap,
  accessibilityLabel,
  itemH,
  pad,
  visible,
  scrollEnabled,
}: WheelProps) {
  const baseLen = values.length;
  const midBase = Math.floor(LOOP_COPIES / 2) * baseLen;
  const looped = useMemo(
    () =>
      Array.from({ length: baseLen * LOOP_COPIES }, (_, i) => values[i % baseLen]!),
    [values, baseLen]
  );

  const midIndexFor = (v: number) => {
    const vi = Math.max(0, values.indexOf(v));
    return midBase + vi;
  };

  const scrollRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(midIndexFor(value) * itemH)).current;
  const offsetRef = useRef(midIndexFor(value) * itemH);
  const lastTickValue = useRef(value);
  const interacting = useRef(false);
  const ignorePropUntil = useRef(0);
  const didInit = useRef(false);
  const settling = useRef(false);
  const dragged = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [ready, setReady] = useState(false);

  const indexFromY = (y: number) =>
    Math.max(0, Math.min(looped.length - 1, Math.round(y / itemH)));

  const jumpTo = (y: number, animated: boolean) => {
    offsetRef.current = y;
    scrollY.setValue(y);
    scrollRef.current?.scrollTo({ y, animated });
  };

  /** If scroll drifts near either end of the repeated list, snap to middle copy. */
  const recenterIfNearEdge = (y: number) => {
    const idx = indexFromY(y);
    const edge = baseLen * 2;
    if (idx < edge || idx > looped.length - edge) {
      const logical = mod(idx, baseLen);
      const target = (midBase + logical) * itemH;
      jumpTo(target, false);
      return target;
    }
    return y;
  };

  const settle = (y: number) => {
    if (settling.current) return;
    settling.current = true;
    const recentered = recenterIfNearEdge(y);
    const rawIndex = indexFromY(recentered);
    const logical = mod(rawIndex, baseLen);
    const next = values[logical]!;
    const target = (midBase + logical) * itemH;
    lastTickValue.current = next;
    interacting.current = false;
    ignorePropUntil.current = Date.now() + 700;
    jumpTo(target, Math.abs(recentered - target) > 0.5);
    if (next !== valueRef.current) onChange(next);
    requestAnimationFrame(() => {
      settling.current = false;
    });
  };

  const placeAtValue = (v: number, animated: boolean) => {
    const target = midIndexFor(v) * itemH;
    jumpTo(target, animated);
    lastTickValue.current = v;
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (!didInit.current) {
        didInit.current = true;
        placeAtValue(value, false);
        setReady(true);
        return;
      }
      if (interacting.current || settling.current) return;
      if (Date.now() < ignorePropUntil.current) return;
      const target = midIndexFor(value) * itemH;
      if (Math.abs(offsetRef.current - target) < 1) return;
      placeAtValue(value, false);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to value/itemH
  }, [value, itemH]);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y;
        offsetRef.current = y;
        const logical = mod(indexFromY(y), baseLen);
        const v = values[logical]!;
        if (v !== lastTickValue.current) {
          lastTickValue.current = v;
          playPickerTick();
        }
      },
    }
  );

  const wheelH = itemH * visible;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      style={[styles.wheel, { height: wheelH, width: 88, opacity: ready ? 1 : 0 }]}
    >
      <Animated.ScrollView
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        snapToInterval={itemH}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEventThrottle={16}
        nestedScrollEnabled
        // Pad centers the selection band; loop copies + recenter mean you never hit a hard stop.
        contentContainerStyle={{ paddingVertical: pad }}
        style={{ height: wheelH }}
        onLayout={() => {
          if (!didInit.current) {
            placeAtValue(valueRef.current, false);
            didInit.current = true;
            setReady(true);
          }
        }}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          dragged.current = true;
          interacting.current = true;
          ignorePropUntil.current = Date.now() + 5000;
        }}
        onScrollEndDrag={(e) => {
          const velocity = Math.abs(e.nativeEvent.velocity?.y ?? 0);
          if (velocity < 0.08) settle(e.nativeEvent.contentOffset.y);
        }}
        onMomentumScrollBegin={() => {
          interacting.current = true;
        }}
        onMomentumScrollEnd={(e) => {
          settle(e.nativeEvent.contentOffset.y);
        }}
        onTouchEnd={() => {
          if (!dragged.current) onTap?.();
          dragged.current = false;
        }}
      >
        {looped.map((item, i) => {
          // Opacity only — scaling Animated.Text rasterizes soft/pixelated glyphs.
          const inputRange = [
            (i - 2) * itemH,
            (i - 1) * itemH,
            i * itemH,
            (i + 1) * itemH,
            (i + 2) * itemH,
          ];
          const opacity = scrollY.interpolate({
            inputRange,
            outputRange: [0.32, 0.55, 1, 0.55, 0.32],
            extrapolate: 'clamp',
          });
          return (
            <View key={`${i}-${item}`} style={[styles.item, { height: itemH }]}>
              <Animated.Text
                allowFontScaling={false}
                style={[styles.itemText, { opacity }]}
              >
                {String(item).padStart(2, '0')}
              </Animated.Text>
            </View>
          );
        })}
      </Animated.ScrollView>
      <View
        pointerEvents="none"
        style={[styles.selection, { top: pad, height: itemH }]}
      />
    </View>
  );
}

type Props = {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  compact?: boolean;
};

export function AppleTimePicker({
  hour,
  minute,
  onChange,
  compact = false,
}: Props) {
  const itemH = compact ? 40 : 44;
  const visible = 5;
  const pad = ((visible - 1) / 2) * itemH;
  const wheelH = itemH * visible;
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => {
    setDraft(formatTime(hour, minute));
    setEditing(true);
  };

  const commitEdit = (raw: string) => {
    const next = parseUnifiedTime(raw, hour, minute);
    onChange(next.hour, next.minute);
    setEditing(false);
    setDraft('');
    Keyboard.dismiss();
  };

  return (
    <View style={styles.wrap}>
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={TIME_ACCESSORY_ID}>
          <View style={styles.accessory}>
            <Pressable
              onPress={() => commitEdit(draft || formatTime(hour, minute))}
              hitSlop={12}
              style={styles.accessoryBtn}
            >
              <Text style={styles.accessoryText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}

      {editing ? (
        <View style={[styles.editWrap, { height: wheelH }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => commitEdit(draft || formatTime(hour, minute))}
          />
          <TextInput
            autoFocus
            value={draft}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^\d:]/g, '').slice(0, 5);
              setDraft(cleaned);
            }}
            onBlur={() => commitEdit(draft || formatTime(hour, minute))}
            onSubmitEditing={() => commitEdit(draft || formatTime(hour, minute))}
            keyboardType="number-pad"
            returnKeyType="done"
            blurOnSubmit
            maxLength={5}
            selectTextOnFocus
            inputAccessoryViewID={
              Platform.OS === 'ios' ? TIME_ACCESSORY_ID : undefined
            }
            style={styles.typedInput}
            selectionColor={accents.gold}
            placeholder="07:30"
            placeholderTextColor={colors.placeholder}
          />
          <Pressable
            onPress={() => commitEdit(draft || formatTime(hour, minute))}
            style={styles.doneBtn}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.row, { height: wheelH }]}>
          <WheelColumn
            values={hours}
            value={hour}
            itemH={itemH}
            pad={pad}
            visible={visible}
            scrollEnabled
            accessibilityLabel="Hour"
            onChange={(h) => onChange(h, minute)}
            onTap={startEdit}
          />
          <Pressable onPress={startEdit} accessibilityRole="button">
            <Text style={styles.colon}>:</Text>
          </Pressable>
          <WheelColumn
            values={minutes}
            value={minute}
            itemH={itemH}
            pad={pad}
            visible={visible}
            scrollEnabled
            accessibilityLabel="Minutes"
            onChange={(m) => onChange(hour, m)}
            onTap={startEdit}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  editWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheel: {
    overflow: 'hidden',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontFamily: fonts.headingRegular,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    textAlign: 'center',
    ...noFakeBold,
  },
  colon: {
    fontFamily: fonts.headingRegular,
    fontSize: 28,
    color: colors.text,
    marginHorizontal: 4,
    marginBottom: 2,
    ...noFakeBold,
  },
  selection: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: inkStroke,
  },
  typedInput: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    color: colors.text,
    textAlign: 'center',
    minWidth: 160,
    fontVariant: ['tabular-nums'],
    ...noFakeBold,
  },
  doneBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.text,
    borderRadius: 999,
  },
  doneText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.bg,
  },
  accessory: {
    backgroundColor: '#EFEFEF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  accessoryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  accessoryText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    color: '#007AFF',
  },
});
