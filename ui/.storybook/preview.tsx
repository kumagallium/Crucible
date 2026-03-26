import type { Preview } from "@storybook/react";
import React from "react";
import { I18nProvider } from "../src/i18n";

// Tailwind CSS v4 のグローバルスタイル（テーマ変数含む）を適用
import "../src/app/globals.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <I18nProvider>
        <Story />
      </I18nProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo"
    }
  },
};

export default preview;
