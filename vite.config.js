import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon-192.png', 'icon-512.png', 'manifest.json'],
            manifest: {
                name: 'Zeiterfassung Pro',
                short_name: 'Zeiterfassung',
                description: 'Professionelle Arbeitszeiterfassung',
                theme_color: '#1e40af',
                background_color: '#111827',
                display: 'standalone',
                icons: [
                    {
                        src: 'icon-192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'icon-512.png',
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
