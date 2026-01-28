// vite.config.js
import { defineConfig } from "file:///Users/johannes/Library/CloudStorage/OneDrive-Backhaus/Antigravity/AppAZeit/node_modules/vite/dist/node/index.js";
import { VitePWA } from "file:///Users/johannes/Library/CloudStorage/OneDrive-Backhaus/Antigravity/AppAZeit/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifestFilename: "manifest.json",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "App a' Zeit",
        short_name: "App a' Zeit",
        description: "Professionelle Arbeitszeiterfassung",
        start_url: "/",
        scope: "/",
        theme_color: "#1e40af",
        background_color: "#111827",
        display: "standalone",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ],
  build: {
    outDir: "docs",
    emptyOutDir: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvam9oYW5uZXMvTGlicmFyeS9DbG91ZFN0b3JhZ2UvT25lRHJpdmUtQmFja2hhdXMvQW50aWdyYXZpdHkvQXBwQVplaXRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9qb2hhbm5lcy9MaWJyYXJ5L0Nsb3VkU3RvcmFnZS9PbmVEcml2ZS1CYWNraGF1cy9BbnRpZ3Jhdml0eS9BcHBBWmVpdC92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvam9oYW5uZXMvTGlicmFyeS9DbG91ZFN0b3JhZ2UvT25lRHJpdmUtQmFja2hhdXMvQW50aWdyYXZpdHkvQXBwQVplaXQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICAgIGJhc2U6ICcuLycsXG4gICAgcGx1Z2luczogW1xuICAgICAgICBWaXRlUFdBKHtcbiAgICAgICAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxuICAgICAgICAgICAgbWFuaWZlc3RGaWxlbmFtZTogJ21hbmlmZXN0Lmpzb24nLFxuICAgICAgICAgICAgaW5jbHVkZUFzc2V0czogWydpY29uLTE5Mi5wbmcnLCAnaWNvbi01MTIucG5nJ10sXG4gICAgICAgICAgICBtYW5pZmVzdDoge1xuICAgICAgICAgICAgICAgIG5hbWU6IFwiQXBwIGEnIFplaXRcIixcbiAgICAgICAgICAgICAgICBzaG9ydF9uYW1lOiBcIkFwcCBhJyBaZWl0XCIsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQcm9mZXNzaW9uZWxsZSBBcmJlaXRzemVpdGVyZmFzc3VuZycsXG4gICAgICAgICAgICAgICAgc3RhcnRfdXJsOiAnLycsXG4gICAgICAgICAgICAgICAgc2NvcGU6ICcvJyxcbiAgICAgICAgICAgICAgICB0aGVtZV9jb2xvcjogJyMxZTQwYWYnLFxuICAgICAgICAgICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjMTExODI3JyxcbiAgICAgICAgICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXG4gICAgICAgICAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3JjOiAnaWNvbi0xOTIucG5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcmM6ICdpY29uLTUxMi5wbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZXM6ICc1MTJ4NTEyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgXSxcbiAgICBidWlsZDoge1xuICAgICAgICBvdXREaXI6ICdkb2NzJyxcbiAgICAgICAgZW1wdHlPdXREaXI6IHRydWVcbiAgICB9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVosU0FBUyxvQkFBb0I7QUFDaGIsU0FBUyxlQUFlO0FBRXhCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQ3hCLE1BQU07QUFBQSxFQUNOLFNBQVM7QUFBQSxJQUNMLFFBQVE7QUFBQSxNQUNKLGNBQWM7QUFBQSxNQUNkLGtCQUFrQjtBQUFBLE1BQ2xCLGVBQWUsQ0FBQyxnQkFBZ0IsY0FBYztBQUFBLE1BQzlDLFVBQVU7QUFBQSxRQUNOLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLFdBQVc7QUFBQSxRQUNYLE9BQU87QUFBQSxRQUNQLGFBQWE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLFNBQVM7QUFBQSxRQUNULE9BQU87QUFBQSxVQUNIO0FBQUEsWUFDSSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsVUFDVjtBQUFBLFVBQ0E7QUFBQSxZQUNJLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxVQUNWO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFBQSxJQUNKLENBQUM7QUFBQSxFQUNMO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDSCxRQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsRUFDakI7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
