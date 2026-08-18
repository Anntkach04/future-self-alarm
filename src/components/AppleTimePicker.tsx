import { useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { playPickerTick } from '../services/pickerTick';
import { accents, colors, fonts, inkStroke, noFakeBold } from '../theme';

const SETTLE_MS = 120;

type WheelProps = {
  values: number[];
  value: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  itemH: number;
  pad: number;
  visible: number;
  scrollEnabled: boolean;
  onCenterPress?: () => void;
};

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

function WheelColumn({
  values,
  value,
  onChange,
  accessibilityLabel,
  itemH,
  pad,
  visible,
  scrollEnabled,
  onCenterPress,
}: WheelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const index = Math.max(0, values.indexOf(value));
  const [offsetY, setOffsetY] = useState(index * itemH);
  const offsetYRef = useRef(index * itemH);
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const dragStartY = useRef(0);
  const programmatic = useRef(false);
  const didInit = useRef(false);
  const lastTickIndex = useRef(index);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSettle = () => {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  };

  const markProgrammatic = (animated: boolean) => {
    programmatic.current = true;
    if (programmaticTimer.current) clearTimeout(programmaticTimer.current);
    programmaticTimer.current = setTimeout(
      () => {
        programmatic.current = false;
      },
      animated ? 320 : 0
    );
  };

  const snapToIndex = (rawIndex: number, animated: boolean) => {
    const clamped = Math.max(0, Math.min(values.length - 1, rawIndex));
    const target = clamped * itemH;
    lastTickIndex.current = clamped;
    if (Math.abs(offsetYRef.current - target) > 0.5) {
      markProgrammatic(animated);
      scrollRef.current?.scrollTo({ y: target, animated });
    }
    offsetYRef.current = target;
    setOffsetY(target);
    const next = values[clamped];
    if (next !== value) onChange(next);
  };

  const settle = (y: number, animated: boolean) => {
    snapToIndex(Math.round(y / itemH), animated);
  };

  useEffect(() => {
    const target = index * itemH;
    const id = requestAnimationFrame(() => {
      if (!didInit.current) {
        didInit.current = true;
        scrollRef.current?.scrollTo({ y: target, animated: false });
        offsetYRef.current = target;
        setOffsetY(target);
        lastTickIndex.current = index;
        return;
      }
      if (dragging.current || programmatic.current) return;
      if (Math.abs(offsetYRef.current - target) <= 1) return;
      markProgrammatic(true);
      scrollRef.current?.scrollTo({ y: target, animated: true });
      offsetYRef.current = target;
      setOffsetY(target);
    });
    return () => cancelAnimationFrame(id);
  }, [index, itemH]);

  useEffect(
    () => () => {
      clearSettle();
      if (programmaticTimer.current) clearTimeout(programmaticTimer.current);
    },
    []
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    offsetYRef.current = y;
    setOffsetY(y);

    const idx = Math.max(
      0,
      Math.min(values.length - 1, Math.round(y / itemH))
    );
    if (!programmatic.current && idx !== lastTickIndex.current) {
      lastTickIndex.current = idx;
      playPickerTick();
    }

    if (dragging.current && Math.abs(y - dragStartY.current) > 4) {
      didDrag.current = true;
    }

    if (dragging.current) return;
    if (Platform.OS !== 'web') return;
    clearSettle();
    settleTimer.current = setTimeout(() => {
      settle(offsetYRef.current, true);
    }, SETTLE_MS);
  };

  const onScrollBeginDrag = () => {
    dragging.current = true;
    didDrag.current = false;
    dragStartY.current = offsetYRef.current;
    clearSettle();
  };

  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    dragging.current = false;
    if (Platform.OS === 'web') {
      clearSettle();
      settleTimer.current = setTimeout(() => {
        settle(offsetYRef.current, true);
      }, SETTLE_MS);
      return;
    }
    const y = e.nativeEvent.contentOffset.y;
    const velocity = e.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocity) < 0.04) {
      settle(y, true);
    }
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    dragging.current = false;
    if (Platform.OS === 'web') return;
    settle(e.nativeEvent.contentOffset.y, true);
  };

  const handleItemPress = (itemIndex: number) => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    const center = Math.round(offsetYRef.current / itemH);
    if (itemIndex === center) {
      onCenterPress?.();
      return;
    }
    snapToIndex(itemIndex, true);
  };

  const center = offsetY / itemH;
  const wheelH = itemH * visible;

  return (
    <View style={[styles.wheel, { height: wheelH, width: 88 }]}>
      <ScrollView
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemH}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum={false}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: pad }}
        style={[
          { height: wheelH },
          Platform.OS === 'web'
            ? (styles.wheelScrollWeb as object)
            : null,
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {values.map((item, i) => {
          const dist = Math.abs(i - center);
          const near = Math.max(0, 1 - dist);
          const falloff = Math.max(0, 1 - dist / 2.15);
          const scale = 0.786 + 0.214 * near;
          const opacity = 0.26 + 0.74 * falloff;
          const label = String(item).padStart(2, '0');
          return (
            <Pressable
              key={item}
              delayPressIn={80}
              onPress={() => handleItemPress(i)}
              accessibilityRole="button"
              accessibilityLabel={`${accessibilityLabel} ${label}`}
              style={[
                { height: itemH, alignItems: 'center', justifyContent: 'center' },
                Platform.OS === 'web' ? (styles.itemSnapWeb as object) : null,
              ]}
            >
              <Text
                style={[
                  styles.itemText,
                  {
                    opacity,
                    transform: [{ scale }],
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View
        pointerEvents="none"
        style={[
          styles.selection,
          { top: pad, height: itemH },
        ]}
      />
    </View>
  );
}

type Props = {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  /** Shorter wheel (3 rows) for screens that also show day picker. */
  compact?: boolean;
};

/** Dual wheel — scroll to pick, tap center to type HH:MM (or HHMM) at once. */
export function AppleTimePicker({
  hour,
  minute,
  onChange,
  compact = false,
}: Props) {
  const itemH = compact ? 40 : 44;
  const visible = compact ? 3 : 5;
  const pad = ((visible - 1) / 2) * itemH;
  const wheelH = itemH * visible;

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const [editingAll, setEditingAll] = useState(false);
  const [draft, setDraft] = useState('');

  const startUnifiedEdit = () => {
    setDraft(
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    );
    setEditingAll(true);
  };

  const commitUnified = (raw: string) => {
    const next = parseUnifiedTime(raw, hour, minute);
    onChange(next.hour, next.minute);
    setEditingAll(false);
    setDraft('');
  };

  const onDraftChange = (text: string) => {
    const cleaned = text.replace(/[^\d:]/g, '').slice(0, 5);
    setDraft(cleaned);
    const digits = cleaned.replace(/\D/g, '');
    if (
      digits.length >= 4 ||
      (cleaned.includes(':') && cleaned.split(':')[1]?.length === 2)
    ) {
      const next = parseUnifiedTime(cleaned, hour, minute);
      onChange(next.hour, next.minute);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { height: wheelH }]}>
        <WheelColumn
          values={hours}
          value={hour}
          itemH={itemH}
          pad={pad}
          visible={visible}
          scrollEnabled={!editingAll}
          accessibilityLabel="Hour"
          onChange={(h) => onChange(h, minute)}
          onCenterPress={startUnifiedEdit}
        />
        <Pressable onPress={startUnifiedEdit} accessibilityRole="button">
          <Text style={styles.colon}>:</Text>
        </Pressable>
        <WheelColumn
          values={minutes}
          value={minute}
          itemH={itemH}
          pad={pad}
          visible={visible}
          scrollEnabled={!editingAll}
          accessibilityLabel="Minutes"
          onChange={(m) => onChange(hour, m)}
          onCenterPress={startUnifiedEdit}
        />
        {editingAll ? (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={onDraftChange}
            onBlur={() => commitUnified(draft)}
            onSubmitEditing={() => commitUnified(draft)}
            keyboardType="numbers-and-punctuation"
            inputMode="decimal"
            maxLength={5}
            selectTextOnFocus
            accessibilityLabel="Type time as HH:MM"
            placeholder="07:30"
            placeholderTextColor={colors.placeholder}
            style={[
              styles.unifiedInput,
              { top: pad, height: itemH },
            ]}
            selectionColor={accents.gold}
            underlineColorAndroid="transparent"
          />
        ) : null}
      </View>
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
  wheel: {
    overflow: 'hidden',
  },
  wheelScrollWeb: {
    scrollSnapType: 'y mandatory',
    overscrollBehavior: 'contain',
  },
  itemSnapWeb: {
    scrollSnapAlign: 'center',
    scrollSnapStop: 'normal',
  },
  itemText: {
    fontFamily: fonts.headingRegular,
    fontSize: 28,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    ...noFakeBold,
    ...(Platform.OS === 'web'
      ? ({
          userSelect: 'none',
          WebkitUserSelect: 'none',
        } as object)
      : null),
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
  unifiedInput: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 5,
    fontFamily: fonts.headingRegular,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    padding: 0,
    margin: 0,
    backgroundColor: colors.bg,
    ...noFakeBold,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
        } as object)
      : null),
  },
});
