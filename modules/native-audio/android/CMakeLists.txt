cmake_minimum_required(VERSION 3.22.1)

project("nativeaudio")

add_library(
    nativeaudio_oboe_stub
    SHARED
    src/main/cpp/AudioRenderer.cpp
    src/main/cpp/OboeEngine.cpp
    src/main/cpp/SamplePlayer.cpp
    src/main/cpp/oboe_click_player_jni.cpp
)

find_package(oboe REQUIRED CONFIG)

target_link_libraries(
    nativeaudio_oboe_stub
    oboe::oboe
    log
)
