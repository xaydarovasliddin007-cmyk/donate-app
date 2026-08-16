# Flutter's own embedding classes are referenced explicitly (not via
# reflection) from GeneratedPluginRegistrant, so the default Flutter Gradle
# plugin rules already keep what's needed. This file only adds rules for
# things known to break under R8 without them.

# Google Sign-In / Play Services Auth — the credential/account classes are
# deserialized via reflection internally; stripping them causes a runtime
# crash on sign-in, not a compile error, so this must stay explicit.
-keep class com.google.android.gms.auth.api.signin.** { *; }
-keep class com.google.android.gms.common.api.** { *; }

# AndroidX Security Crypto (flutter_secure_storage's Keystore-backed impl).
-keep class androidx.security.crypto.** { *; }

# Keep annotation default values used by the above (R8 default already
# ships this via proguard-android-optimize.txt, kept here for clarity).
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
