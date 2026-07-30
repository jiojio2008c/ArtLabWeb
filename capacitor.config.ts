import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.artlab.web',
  appName: 'MagicFloor',
  webDir: 'dist',
  plugins: {
    Camera: {
      permission: {
        photosLibrary: {
          description: '允許 MagicFloor 存取您的照片圖庫',
        },
        camera: {
          description: '允許 MagicFloor 使用您的相機',
        },
      },
    },
    Filesystem: {
      permission: {
        description: '允許 MagicFloor 存取您的檔案',
      },
    },
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#ffffff',
  },
};

export default config;
