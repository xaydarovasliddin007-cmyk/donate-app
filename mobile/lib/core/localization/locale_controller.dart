import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/preferences_provider.dart';

/// The set of locales the app ships translations for today. Adding English
/// or another language later is just: add the ARB file + append here.
const supportedLocales = [Locale('uz'), Locale('ru')];
const defaultLocale = Locale('uz');

class LocaleController extends Notifier<Locale> {
  @override
  Locale build() {
    final saved = ref.read(preferencesServiceProvider).locale;
    // No explicit choice yet (first launch, or never changed from Settings)
    // -> follow the device's system language instead of hardcoding Uzbek,
    // falling back to Uzbek only when the device language isn't one we ship.
    // Once the user picks a language in Settings, that choice is persisted
    // and always wins from then on, regardless of device language.
    if (saved == null) return _matchSupported(PlatformDispatcher.instance.locale.languageCode);
    return _matchSupported(saved);
  }

  Future<void> setLocale(Locale locale) async {
    state = locale;
    await ref.read(preferencesServiceProvider).setLocale(locale.languageCode);
  }

  static Locale _matchSupported(String? languageCode) {
    final match = supportedLocales.where((l) => l.languageCode == languageCode);
    return match.isNotEmpty ? match.first : defaultLocale;
  }
}

final localeControllerProvider = NotifierProvider<LocaleController, Locale>(LocaleController.new);
