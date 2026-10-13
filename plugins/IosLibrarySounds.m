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

@end
