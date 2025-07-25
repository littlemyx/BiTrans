#import "AudioPanning.h"
#import <React/RCTLog.h>
#import "AudioPanning-Swift.h" // Import Swift bridge

@interface AudioPanning()
@property (nonatomic, strong) AudioEngine *audioEngine;
@end

@implementation AudioPanning

RCT_EXPORT_MODULE();

- (instancetype)init
{
  self = [super init];
  if (self) {
    self.audioEngine = [AudioEngine create];
  }
  return self;
}

RCT_EXPORT_METHOD(playFile:(NSString *)path side:(NSString *)side resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  [self.audioEngine playFile:path side:side resolver:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(stop)
{
  [self.audioEngine stop];
}

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end 