Pod::Spec.new do |s|
  s.name           = 'NativeAudioModule'
  s.version        = '0.1.0'
  s.summary        = 'PulseGrid native audio module'
  s.description    = 'Local Expo module for native metronome audio'
  s.author         = 'PulseGrid'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'

  # Explicit resource bundle so WAVs are packaged reliably with static frameworks
  # (s.resources alone often fails to land in Bundle.main on EAS/release builds).
  s.resource_bundles = {
    'NativeAudioModuleAssets' => ['Assets/*.wav']
  }
end
