#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PendingRecipesModule, NSObject)

RCT_EXTERN_METHOD(getPendingRecipes:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearPendingRecipes:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(removePendingRecipe:(NSString *)recipeId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

@end
