# Framework and language integration guide

Universal Player is a browser-side JavaScript video player, not a Python or Java playback library. Any framework/backend that can serve an HTML element and static assets can use the same built JavaScript and CSS. The end user's browser loads and decodes the media.

## 1. Install the package

Requirements: Node.js 20.19+ and npm.

Before a public npm registry release, install the current repository using npm's Git dependency syntax:

~~~bash
npm install github:WorkRCS/easy-video-player
~~~

The package's prepare lifecycle builds the library, CSS, TypeScript declarations and provider chunks during installation. After the scoped package is published to npm, use:

~~~bash
npm install @labsadik/universal-player
~~~

To run the website locally:

~~~bash
git clone https://github.com/WorkRCS/easy-video-player.git
cd easy-video-player
npm install
npm run dev
~~~

## 2. Basic plug-and-play example

Put a mount element in the HTML:

~~~html
<div id="video-player"></div>
~~~

Import the CSS and create the player after the element is present:

~~~ts
import { createPlayer } from '@labsadik/universal-player';
import '@labsadik/universal-player/style.css';

const player = createPlayer('#video-player', {
  source: '/media/sample.mp4',
  theme: 'system',
  aspectRatio: '16 / 9',
});
~~~

Serve the media URL from your own public/static directory, or use a playable HTTPS MP4, HLS (.m3u8), DASH (.mpd) URL, or supported provider embed. Call player.destroy() when the view/component is removed.

## 3. JavaScript frontend frameworks

### Vanilla JavaScript / TypeScript, Vite, Parcel, Webpack

Use the basic example above in the browser entry module. Import the stylesheet once. The bundler includes the package CSS and provider chunks in the production output.

### React / Next.js

The player requires the DOM, so mount it inside an effect, not during server rendering. Next.js App Router components that use this must include the client directive.

~~~tsx
'use client';
import { useEffect, useRef } from 'react';
import { createPlayer } from '@labsadik/universal-player';
import '@labsadik/universal-player/style.css';
export function VideoPlayer({ src }: { src: string }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mount.current) return;
    const player = createPlayer(mount.current, { source: src, theme: 'system' });
    return () => player.destroy();
  }, [src]);
  return <div ref={mount} />;
}
~~~

### Vue 3 / Nuxt

~~~vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { createPlayer } from '@labsadik/universal-player';
import '@labsadik/universal-player/style.css';
const mount = ref<HTMLDivElement | null>(null);
let player: ReturnType<typeof createPlayer> | undefined;
onMounted(() => {
  if (mount.value) player = createPlayer(mount.value, { source: '/media/sample.mp4', theme: 'system' });
});
onBeforeUnmount(() => player?.destroy());
</script>
<template><div ref="mount"></div></template>
~~~

For Nuxt, create the player only in onMounted or a client-only component.

### Svelte / SvelteKit

~~~svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createPlayer } from '@labsadik/universal-player';
  import '@labsadik/universal-player/style.css';
  let mount: HTMLDivElement;
  onMount(() => {
    const player = createPlayer(mount, { source: '/media/sample.mp4', theme: 'system' });
    return () => player.destroy();
  });
</script>
<div bind:this={mount}></div>
~~~

### Angular

Add the stylesheet to the global styles. Create the player after the view exists and destroy it on component teardown.

~~~ts
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { createPlayer } from '@labsadik/universal-player';
@Component({ selector: 'app-video-player', template: '<div #mount></div>' })
export class VideoPlayerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mount') mount!: ElementRef<HTMLDivElement>;
  private player?: ReturnType<typeof createPlayer>;
  ngAfterViewInit() {
    this.player = createPlayer(this.mount.nativeElement, { source: '/media/sample.mp4', theme: 'system' });
  }
  ngOnDestroy() { this.player?.destroy(); }
}
~~~

### Astro, Solid, Qwik, Lit, Alpine, Remix, Nuxt, and other frontend frameworks

Use the framework's browser/client lifecycle. Create only after the mount element exists and register destroy() in its cleanup hook. Examples: Astro client islands, Solid onMount/onCleanup, Lit firstUpdated/disconnectedCallback, Remix useEffect, Alpine x-init plus teardown. SSR frameworks need their client-only boundary.

## 4. Python servers: FastAPI, Flask, Django, Starlette

Python serves HTML, media and the static player bundle; the browser executes the player. Build with npm, then copy the JavaScript, stylesheet and full provider chunks directory. Preserve their relative paths.

~~~bash
npm install github:WorkRCS/easy-video-player
mkdir -p static/player/chunks
cp node_modules/@labsadik/universal-player/dist/universal-player.js static/player/
cp node_modules/@labsadik/universal-player/dist/universal-player.css static/player/
cp -R node_modules/@labsadik/universal-player/dist/chunks/* static/player/chunks/
~~~

If working in a checkout of this repository, copy those files from its dist/ directory instead of node_modules.

FastAPI route example:

~~~python
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()
app.mount('/player', StaticFiles(directory='static/player'), name='player')
templates = Jinja2Templates(directory='templates')

@app.get('/')
def watch(request: Request):
    return templates.TemplateResponse(request, 'watch.html')
~~~

In templates/watch.html (or an equivalent Flask/Jinja or Django template):

~~~html
<div id="video-player"></div>
<link rel="stylesheet" href="/player/universal-player.css">
<script type="module">
  import { createPlayer } from '/player/universal-player.js';
  createPlayer('#video-player', { source: '/media/sample.mp4', theme: 'system' });
</script>
~~~

Flask/Django use the same markup with their normal static-file and template configuration. There is no Python runtime wrapper to install.

## 5. Java servers: Spring Boot, Thymeleaf, JSP, Jakarta EE

The player is not a Maven dependency. Copy the JavaScript, CSS and full chunks/ directory into src/main/resources/static/player/; Spring Boot will serve those files from /player/.

~~~bash
npm install github:WorkRCS/easy-video-player
mkdir -p src/main/resources/static/player/chunks
cp node_modules/@labsadik/universal-player/dist/universal-player.js src/main/resources/static/player/
cp node_modules/@labsadik/universal-player/dist/universal-player.css src/main/resources/static/player/
cp -R node_modules/@labsadik/universal-player/dist/chunks/* src/main/resources/static/player/chunks/
~~~

In a Thymeleaf/JSP view:

~~~html
<div id="video-player"></div>
<link rel="stylesheet" href="/player/universal-player.css">
<script type="module">
  import { createPlayer } from '/player/universal-player.js';
  createPlayer('#video-player', { source: '/media/sample.mp4', theme: 'system' });
</script>
~~~

The same static bundle approach works for Spring MVC/WebFlux, Quarkus, Jakarta EE and Micronaut. Java serves the page; npm is the frontend build tool.

## 6. PHP/Laravel, Ruby/Rails, Go and .NET

Use the same browser snippet in your server-rendered template and preserve the bundle structure:

- PHP / Laravel: put files in public/player/ and use a Blade/PHP template.
- Ruby / Rails: put files in public/player/ or bundle through jsbundling-rails; use an ERB template.
- Go net/http, Gin, Echo and Fiber: serve a static directory and mount the HTML template.
- ASP.NET Core / MVC / Razor: put assets under wwwroot/player/.
- Blazor: create via JS interop during OnAfterRenderAsync(firstRender: true) and call destroy() when disposing.
- Node.js / Express, Fastify, Koa and NestJS: use the vanilla integration in a Vite bundle or serve assets directly.

## 7. Optional features and themes

~~~ts
player.setTheme('system'); // light, dark, or system
player.setAccentColor('#7c3aed');
player.setGlassEffect(false);
player.setControlsStyle('compact');
player.setFeatures({ miniPlayer: true, theaterMode: true, playbackSpeed: true });
~~~

Core controls are play/pause, skip, seek timeline, volume/mute, captions, settings/quality when the stream exposes multiple renditions, Picture-in-Picture and fullscreen. Playback speed, mini player and theater mode are opt-in.

## 8. Playback smoothness and compatibility

- Browser/device codec and hardware decoding support affect smoothness.
- HLS/DASH manifests must be accessible, with CORS/byte-range support and valid media segments.
- For variable bandwidth, serve adaptive HLS/DASH with a bitrate ladder and leave adaptive quality on instead of forcing a high rendition.
- Bitrate, encoding, network quality, the CDN/origin server, device thermals/memory and embedded-provider restrictions can all cause buffering independently of player UI performance.
- No player can promise zero buffering on every codec, device and internet connection; DRM, private media and unsupported codecs require their own compatible access/setup.
