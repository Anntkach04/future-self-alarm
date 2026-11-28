#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch(rel: str, pairs: list[tuple[str, str]]) -> None:
    p = ROOT / rel
    if not p.exists():
        return
    s = p.read_text()
    orig = s
    for a, b in pairs:
        s = s.replace(a, b)
    if s != orig:
        p.write_text(s)
        print("patched", rel)


def patch_file(rel: str, fn) -> None:
    p = ROOT / rel
    if not p.exists():
        return
    s = p.read_text()
    s2 = fn(s)
    if s2 != s:
        p.write_text(s2)
        print("patched", rel)


# expo-av
patch("node_modules/expo-av/ios/EXAV/EXAV.h", [
    ("#import <ExpoModulesCore/EXEventEmitter.h>\n", ""),
    (", EXEventEmitter", ""),
])
patch("node_modules/expo-av/ios/EXAV/Video/EXVideoView.h", [
    ("#import <ExpoModulesCore/EXLegacyExpoViewProtocol.h>\n", ""),
    (", EXLegacyExpoViewProtocol", ""),
])
patch("node_modules/expo-av/ios/EXAV/Video/VideoViewModule.swift", [
    ("resolver: promise.resolver", "resolver: promise.legacyResolver"),
])

event_emitter_fix = '''Protocol *eventEmitterProtocol = NSProtocolFromString(@"EXEventEmitterService");
  if (!eventEmitterProtocol) { return; }
  id eventEmitter = [_expoModuleRegistry getModuleImplementingProtocol:eventEmitterProtocol];
  if (eventEmitter && [eventEmitter respondsToSelector:@selector(sendEventWithName:body:)]) {
    [eventEmitter sendEventWithName:eventName body:body];
  }'''

for rel in ["node_modules/expo-av/ios/EXAV/EXAV.m", "node_modules/expo-av/ios/EXAV/EXAVTV.m"]:
    patch(rel, [
        ("#import <ExpoModulesCore/EXEventEmitterService.h>\n", ""),
        (
            "[[_expoModuleRegistry getModuleImplementingProtocol:@protocol(EXEventEmitterService)] sendEventWithName:eventName body:body];",
            event_emitter_fix,
        ),
    ])

patch("node_modules/expo-av/ios/EXAV/EXAudioRecordingPermissionRequester.m", [
    (
        'EXFatal(EXErrorWithMessage(@"This app is missing NSMicrophoneUsageDescription, so audio services will fail. Add one of these keys to your bundle\'s Info.plist."));',
        'NSLog(@"[expo-av] Missing NSMicrophoneUsageDescription in Info.plist.");',
    ),
])

patch("node_modules/expo-notifications/ios/EXNotifications/Badge/BadgeModule.swift", [
    (
        "EXSharedApplication().applicationIconBadgeNumber",
        "UIApplication.shared.applicationIconBadgeNumber",
    ),
])
patch("node_modules/expo-notifications/ios/EXNotifications/Permissions/PermissionsModule.swift", [
    ("resolve: promise.resolver", "resolve: promise.legacyResolver"),
])

# personal team: no push entitlement
ent = ROOT / "ios/FutureSelfAlarm/FutureSelfAlarm.entitlements"
if ent.exists():
    ent.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" '
        '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
        "<plist version=\"1.0\"><dict></dict></plist>\n"
    )
    print("patched", ent.relative_to(ROOT))

# force old architecture flag in Info.plist
info = ROOT / "ios/FutureSelfAlarm/Info.plist"
if info.exists():
    s = info.read_text()
    s2 = s.replace("<key>RCTNewArchEnabled</key>\n\t<true/>", "<key>RCTNewArchEnabled</key>\n\t<false/>")
    if s2 != s:
        info.write_text(s2)
        print("patched Info.plist RCTNewArchEnabled=false")

props = ROOT / "ios/Podfile.properties.json"
if props.exists():
    import json

    data = json.loads(props.read_text())
    data["newArchEnabled"] = "false"
    props.write_text(json.dumps(data, indent=2) + "\n")
    print("patched Podfile.properties.json newArchEnabled=false")

print("done")
