import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.artlab.web',
  appName: 'Art Lab Web',
  webDir: 'dist',
  plugins: {
    Camera: {
      permission: {
        photosLibrary: {
          description: 'Allow Art Lab to access your photo library',
        },
        camera: {
          description: 'Allow Art Lab to use your camera',
        },
      },
    },
    Filesystem: {
      permission: {
        description: 'Allow Art Lab to access your files',
      },
    },
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#ffffff',
  },
};

export default config;
