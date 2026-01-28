import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    base: './',
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            manifestFilename: 'manifest.json',
            includeAssets: ['icon-192-v2.png', 'icon-512-v2.png'],
            manifest: {
                name: "App a' Zeit",
                short_name: "App a' Zeit",
                description: 'Professionelle Arbeitszeiterfassung',
                start_url: '/',
                scope: '/',
                theme_color: '#1e40af',
                background_color: '#111827',
                display: 'standalone',
                icons: [
                    {
                        src: 'icon-192-v2.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'icon-512-v2.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ],
    build: {
        outDir: 'docs',
        emptyOutDir: true
    }
});
