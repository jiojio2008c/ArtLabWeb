import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.magicfloor.artlab',
  appName: 'MagicFloor',
  webDir: 'dist',
  plugins: {
    Camera: {
      permission: {
        photosLibrary: {
          description: 'MagicFloor 只在你主動從相簿選擇素材時讀取照片或影片。例如你從相簿選一張展品照片，加入動態藝術作品。',
        },
        camera: {
          description: 'MagicFloor 只在你主動拍照或掃描遮罩卡時使用相機。例如你拍攝一幅畫作並套用遮罩後，照片會傳送到你設定的藝術畫廊顯示。',
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
