#import <React/RCTBridgeModule.h>
#import <Foundation/Foundation.h>

@interface IosLibrarySounds : NSObject <RCTBridgeModule>
@end

@implementation IosLibrarySounds

RCT_EXPORT_MODULE(IosLibrarySounds);

RCT_EXPORT_METHOD(writeBase64Sound:(NSString *)fileName
                  base64:(NSString *)base64
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *safeName = fileName.lastPathComponent;
  if (safeName.length == 0 || [safeName hasPrefix:@"."]) {
    reject(@"E_SOUND_NAME", @"Invalid sound file name", nil);
    return;
  }

  NSData *data = [[NSData alloc] initWithBase64EncodedString:base64
                                                     options:NSDataBase64DecodingIgnoreUnknownCharacters];
  if (!data || data.length < 100) {
    reject(@"E_SOUND_DATA", @"Could not decode sound base64", nil);
    return;
  }

  NSError *error = nil;
  NSURL *library = [[NSFileManager.defaultManager URLsForDirectory:NSLibraryDirectory
                                                         inDomains:NSUserDomainMask] firstObject];
  NSURL *sounds = [library URLByAppendingPathComponent:@"Sounds" isDirectory:YES];
  if (![NSFileManager.defaultManager createDirectoryAtURL:sounds
                              withIntermediateDirectories:YES
                                               attributes:nil
                                                    error:&error]) {
    reject(@"E_SOUND_DIR", error.localizedDescription ?: @"Could not create Library/Sounds", error);
    return;
  }

  NSURL *dest = [sounds URLByAppendingPathComponent:safeName];
  if (![data writeToURL:dest options:NSDataWritingAtomic error:&error]) {
    reject(@"E_SOUND_WRITE", error.localizedDescription ?: @"Could not write sound file", error);
    return;
  }

  resolve(dest.absoluteString);
}

RCT_EXPORT_METHOD(soundExists:(NSString *)fileName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *safeName = fileName.lastPathComponent;
  NSURL *library = [[NSFileManager.defaultManager URLsForDirectory:NSLibraryDirectory
                                                         inDomains:NSUserDomainMask] firstObject];
  NSURL *dest = [[library URLByAppendingPathComponent:@"Sounds" isDirectory:YES]
                 URLByAppendingPathComponent:safeName];
  resolve(@([NSFileManager.defaultManager fileExistsAtPath:dest.path]));
}

/** Delete stale fs_alarm_*.caf (old bali/spa mixes) from Library/Sounds. */
RCT_EXPORT_METHOD(clearFutureSelfAlarmSounds:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *library = [[NSFileManager.defaultManager URLsForDirectory:NSLibraryDirectory
                                                         inDomains:NSUserDomainMask] firstObject];
  NSURL *sounds = [library URLByAppendingPathComponent:@"Sounds" isDirectory:YES];
  NSArray<NSURL *> *files = [NSFileManager.defaultManager
      contentsOfDirectoryAtURL:sounds
      includingPropertiesForKeys:nil
      options:NSDirectoryEnumerationSkipsHiddenFiles
      error:nil];
  NSInteger removed = 0;
  for (NSURL *url in files) {
    NSString *name = url.lastPathComponent;
    if ([name hasPrefix:@"fs_alarm_"] && [name.pathExtension.lowercaseString isEqualToString:@"caf"]) {
      if ([NSFileManager.defaultManager removeItemAtURL:url error:nil]) {
        removed += 1;
      }
    }
  }
  resolve(@(removed));
}


/**
 * The phone's time zone right now, plus the next `days` calendar days in it.
 * resetSystemTimeZone drops iOS's cached zone, so a trip is seen at once even
 * while the app stayed in memory (the JS engine keeps the launch-time zone).
 */
RCT_EXPORT_METHOD(zoneInfo:(nonnull NSNumber *)days
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [NSTimeZone resetSystemTimeZone];
  NSTimeZone *tz = [NSTimeZone systemTimeZone];
  NSCalendar *cal = [[NSCalendar alloc] initWithCalendarIdentifier:NSCalendarIdentifierGregorian];
  cal.timeZone = tz;
  NSDate *start = [cal startOfDayForDate:[NSDate date]];
  NSMutableArray *out = [NSMutableArray array];
  NSInteger count = MAX(1, MIN(days.integerValue, 60));
  for (NSInteger i = 0; i < count; i++) {
    NSDate *day = [cal dateByAddingUnit:NSCalendarUnitDay value:i toDate:start options:0];
    NSDateComponents *c = [cal components:(NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitWeekday)
                                 fromDate:day];
    NSDate *noon = [day dateByAddingTimeInterval:12 * 3600];
    [out addObject:@{
      @"y": @(c.year),
      @"m": @(c.month),
      @"d": @(c.day),
      // NSCalendar: 1 = Sunday … 7 = Saturday → JS getDay(): 0 = Sunday.
      @"weekday": @(c.weekday - 1),
      @"offsetMin": @([tz secondsFromGMTForDate:noon] / 60),
    }];
  }
  resolve(@{ @"zone": tz.name ?: @"", @"days": out });
}

@end
