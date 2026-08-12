import { createRoot } from 'react-dom/client';
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import 'antd/dist/reset.css';
import './main.less';
import App from './App.jsx';
import { store } from './store';

const antdThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#ff6846',
    colorInfo: '#6ca8ff',
    colorSuccess: '#64d8af',
    colorWarning: '#f2b84b',
    colorError: '#ff6d78',
    colorText: '#f4f1ea',
    colorTextSecondary: '#9d9992',
    colorTextPlaceholder: '#77736d',
    colorBorder: '#343337',
    colorBorderSecondary: '#49464a',
    colorBgBase: '#0b0b0c',
    colorBgContainer: '#151517',
    colorBgElevated: '#1c1c1f',
    colorFillSecondary: 'rgba(42, 41, 43, 0.92)',
    colorFillTertiary: 'rgba(31, 30, 32, 0.92)',
    controlOutline: 'rgba(255, 104, 70, 0.24)',
    controlItemBgActive: 'rgba(255, 104, 70, 0.18)',
    controlItemBgHover: 'rgba(255, 104, 70, 0.1)',
    borderRadius: 11,
    wireframe: false,
    fontFamily: "'Aptos', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  components: {
    Button: {
      primaryShadow: '0 10px 24px rgba(255, 104, 70, 0.2)',
      defaultBg: 'rgba(31, 31, 34, 0.96)',
      defaultBorderColor: '#555157',
      defaultColor: '#f4f1ea',
    },
    Input: {
      activeBorderColor: '#ff6846',
      hoverBorderColor: '#ff8a6f',
      activeShadow: '0 0 0 3px rgba(255, 104, 70, 0.14)',
    },
    Select: {
      optionSelectedBg: 'rgba(255, 104, 70, 0.18)',
      optionActiveBg: 'rgba(255, 104, 70, 0.1)',
      zIndexPopup: 1400,
    },
    Modal: {
      contentBg: '#1c1c1f',
      headerBg: '#1c1c1f',
      titleColor: '#f4f1ea',
    },
    Drawer: {
      colorBgElevated: '#1c1c1f',
    },
  },
};

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <ConfigProvider locale={zhCN} theme={antdThemeConfig}>
      <AntdApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  </Provider>,
);
