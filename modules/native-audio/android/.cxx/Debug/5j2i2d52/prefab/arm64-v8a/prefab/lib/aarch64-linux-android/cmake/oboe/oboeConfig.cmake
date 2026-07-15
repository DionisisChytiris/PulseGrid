if(NOT TARGET oboe::oboe)
add_library(oboe::oboe SHARED IMPORTED)
set_target_properties(oboe::oboe PROPERTIES
    IMPORTED_LOCATION "D:/.gradle/caches/8.14.3/transforms/0cb0b508e366a3d8ff1a36493f9d0d20/transformed/oboe-1.10.0/prefab/modules/oboe/libs/android.arm64-v8a/liboboe.so"
    INTERFACE_INCLUDE_DIRECTORIES "D:/.gradle/caches/8.14.3/transforms/0cb0b508e366a3d8ff1a36493f9d0d20/transformed/oboe-1.10.0/prefab/modules/oboe/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

