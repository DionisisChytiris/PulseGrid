Pod::Spec.new do |s|
  s.name           = 'NativeAudioModule'
  s.version        = '0.1.0'
  s.summary        = 'PulseGrid native audio module'
  s.description    = 'Local Expo module for native metronome audio'
  s.author         = 'PulseGrid'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.resources = 'Assets/*.wav'
end
