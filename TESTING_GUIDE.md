# 🧪 ARFLIX Testing Guide

## 🚀 Quick Start

**App URL**: http://localhost:5176

De development server draait al! Open de URL in je browser.

---

## ✅ Test Checklist

### 1. 🏠 **HomePage - Initial Load Test**
- [ ] App laadt zonder errors (check Console: F12)
- [ ] Hero sectie is zichtbaar met trending content
- [ ] "Continue Watching" carousel (als je al eerder iets hebt gekeken)
- [ ] "Trending Movies" carousel
- [ ] "Trending TV Shows" carousel
- [ ] Sidebar is zichtbaar met navigatie

**✨ Verwacht gedrag**:
- Initial load: ~600KB (check Network tab)
- Console: `[Cache MISS] tmdb:trending:movies` (eerste keer)
- Console: `[Cache HIT] tmdb:trending:movies` (bij refresh binnen 10 min)

---

### 2. ⚡ **Performance Test - Code Splitting**

**Test Lazy Loading**:
1. Open DevTools → Network tab
2. Filter op "JS"
3. Refresh de pagina
4. ✅ Je zou ALLEEN moeten zien:
   - `index.js` (~141 KB)
   - `react-vendor.js` (~141 KB)
   - `player-vendor.js` (~1491 KB)
   - `supabase-vendor.js` (~126 KB)
   - `ui-vendor.js` (~14 KB)

5. Navigeer naar een Details page (klik op een film/serie)
6. ✅ Nu moet je zien:
   - `DetailsPage-*.js` (~22 KB) - **Lazy loaded!**

7. Navigeer naar Settings
8. ✅ Nu moet je zien:
   - `SettingsPage-*.js` (~11 KB) - **Lazy loaded!**

**Expected**: Pages laden alleen wanneer je ze bezoekt ✅

---

### 3. 🎬 **Details Page Test**

**Navigeer naar een film/serie details**:
1. Klik op een content card op de homepage
2. Wait for `DetailsPage-*.js` to load (check Network tab)
3. Details page toont:
   - [ ] Film/serie titel
   - [ ] Rating & year
   - [ ] Backdrop image
   - [ ] Overview/description
   - [ ] Cast members (met foto's)
   - [ ] "Play" button
   - [ ] "Add to Watchlist" button

**✨ Test Error Boundary**:
- Als er een error is, zie je een mooie error page (niet een witte crash)
- "Something went wrong" met stack trace (in dev mode)

---

### 4. 🎥 **Player Test**

**Start een video**:
1. Klik "Play" op een details page
2. Wait for `PlayerPageNew-*.js` to load (~51 KB)
3. Player opent:
   - [ ] Video player UI is zichtbaar
   - [ ] Controls: play/pause, volume, progress bar
   - [ ] Quality selector (als beschikbaar)
   - [ ] Subtitle selector (als beschikbaar)
   - [ ] Fullscreen knop

**Test Subtitles** (als streams beschikbaar zijn):
1. Klik op subtitle icon
2. Selecteer Engels
3. Subtitles laden automatisch
4. ✅ Console: subtitle fetch logs

---

### 5. 🔍 **Search Test**

1. Klik op Search in sidebar (of druk `/`)
2. Wait for `SearchPage-*.js` to load (~3 KB)
3. Type een zoekopdracht (bijv. "Inception")
4. Results verschijnen
5. Klik op een result → navigeert naar details

---

### 6. ⚙️ **Settings Test**

1. Klik op Settings in sidebar
2. Wait for `SettingsPage-*.js` to load (~11 KB)
3. Settings page opent
4. Check alle opties zijn zichtbaar

---

### 7. 📝 **Subtitle System Test**

**Test verschillende formaten**:

Open DevTools Console en test de subtitle processor:

```javascript
// In Console (F12)
const { parseSubtitleFile, convertToVTT } = await import('./src/lib/subtitleProcessor');

// Test SRT
const srtContent = `1
00:00:01,000 --> 00:00:04,000
Hello World

2
00:00:05,000 --> 00:00:08,000
Second subtitle`;

const cues = parseSubtitleFile(srtContent, 'srt');
console.log('Parsed cues:', cues);

// Convert to VTT
const vtt = convertToVTT(cues);
console.log('VTT output:', vtt);
```

**✅ Verwacht**: Cues array met startTime, endTime, text

---

### 8. 💾 **Cache Test**

**Test API Caching**:

1. Open DevTools Console
2. Refresh homepage
3. ✅ Zie: `[Cache MISS] tmdb:trending:movies`
4. Refresh homepage again (binnen 10 min)
5. ✅ Zie: `[Cache HIT] tmdb:trending:movies`
6. Wait 10+ minutes (or clear localStorage)
7. Refresh
8. ✅ Zie: `[Cache MISS]` again

**Test Cache Statistics**:
```javascript
// In Console
const { apiCache } = await import('./src/lib/cache');
console.log(apiCache.stats());
```

**✅ Verwacht**: `{ size: X, maxSize: 100, keys: [...] }`

---

### 9. 🔔 **Notification System Test**

**Test Toast Notifications**:

Open Console en trigger notifications:

```javascript
// Import notification hook
const { useNotificationStore } = await import('./src/components/Notifications');
const store = useNotificationStore.getState();

// Test success
store.success('Success!', 'This is a success message');

// Test error
store.error('Error!', 'Something went wrong');

// Test info
store.info('Info', 'Just so you know...');

// Test warning
store.warning('Warning', 'Be careful!');
```

**✅ Verwacht**: Toast notifications verschijnen top-right, auto-dismiss na 5s

---

### 10. ⚠️ **Error Boundary Test**

**Force een error**:

```javascript
// In Console - Force a React error
throw new Error('Test error for ErrorBoundary');
```

**✅ Verwacht**:
- ErrorBoundary vangt de error
- Mooie error UI verschijnt
- Stack trace zichtbaar (dev mode)
- "Try again" knop werkt
- App crashed niet helemaal

---

### 11. 📱 **Service Worker Test**

**Check Service Worker**:

1. Open DevTools → Application tab
2. Ga naar "Service Workers"
3. ✅ Zie: `service-worker.js` - Status: "activated and running"

**Test Caching**:
1. Navigate door de app
2. Open Application → Cache Storage
3. ✅ Zie caches:
   - `arflix-static-v2`
   - `arflix-dynamic-v2`
   - `arflix-images-v2`

**Test Offline**:
1. Open DevTools → Network tab
2. Select "Offline" (dropdown)
3. Refresh de pagina
4. ✅ App laadt nog steeds (vanuit cache)
5. Console: `[SW] Network failed, trying cache...`

---

### 12. 🔐 **TMDB Proxy Test** (als deployed)

**Check of proxy gebruikt wordt**:

1. Open DevTools → Network tab
2. Filter op "tmdb"
3. Refresh homepage
4. ✅ Verwacht:
   - Als `USE_PROXY = true`: Requests gaan naar `https://xxx.supabase.co/functions/v1/tmdb-proxy`
   - Als `USE_PROXY = false`: Requests gaan naar `https://api.themoviedb.org/3/...`

**Test Proxy** (in Console):
```javascript
// Check USE_PROXY flag
const tmdb = await import('./src/lib/tmdb');
// Proxy is active als supabase.functions.invoke wordt gebruikt
```

---

## 🐛 **Common Issues & Fixes**

### Issue: "Port 5176 already in use"
**Fix**: Server draait al! Open http://localhost:5176

### Issue: TypeScript errors
**Fix**: 
```bash
npm run typecheck
```
Zou 0 errors moeten geven ✅

### Issue: Build fails
**Fix**:
```bash
npm run build
```
Zou succesvol moeten zijn ✅

### Issue: Missing environment variables
**Fix**: Check `.env` bestand:
```bash
cat .env
```
Zou moeten bevatten:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_TMDB_API_KEY

### Issue: No content loading
**Fix**: Check Console voor errors:
- TMDB API key incorrect?
- Supabase niet connected?
- Network errors?

### Issue: Subtitles not loading
**Fix**: 
- Check if content has subtitles available
- Console logs: `[fetchSubtitles]` debug info
- OpenSubtitles/Subscene might be down

---

## 📊 **Performance Metrics**

Open DevTools → Lighthouse:

**Run audit**:
1. Click "Generate report"
2. ✅ Expected scores:
   - Performance: 90+ (with lazy loading)
   - Accessibility: 90+
   - Best Practices: 90+
   - SEO: 90+
   - PWA: 80+ (installable)

---

## 🎯 **Success Criteria**

Your app is working correctly if:

- ✅ No console errors (some warnings are OK)
- ✅ TypeScript: 0 errors
- ✅ Build: Successful
- ✅ Initial load: <1s (with fast internet)
- ✅ Code splitting: Pages lazy load
- ✅ API caching: Cache HIT after first load
- ✅ Error boundary: Catches errors gracefully
- ✅ Notifications: Toast messages work
- ✅ Service Worker: Active and caching
- ✅ Offline: App loads from cache

---

## 🔍 **Debug Tools**

**Check logs**:
```bash
# Console logs in browser (F12)
# Look for:
[Cache HIT/MISS]
[fetchSubtitles]
[SW] Service worker messages
```

**Check Network**:
- Filter by "JS" → See lazy loaded chunks
- Filter by "XHR" → See API calls
- Filter by "Img" → See image loading

**Check Application**:
- Service Workers → Status
- Cache Storage → Cached files
- Local Storage → Cached data

---

## 🚀 **Next: Production Testing**

Once local testing passes, deploy and test:

1. Deploy to Vercel/Netlify
2. Test production build
3. Test TMDB proxy (if deployed)
4. Test on mobile devices
5. Test on different browsers
6. Check Lighthouse scores

---

## 📝 **Test Report Template**

```markdown
# ARFLIX Test Report

**Date**: [DATE]
**Tester**: [NAME]
**Version**: [GIT COMMIT HASH]

## Results:

- [ ] HomePage loads correctly
- [ ] Performance: Initial load < 1s
- [ ] Code splitting works
- [ ] Details page works
- [ ] Player works
- [ ] Search works
- [ ] Settings works
- [ ] Subtitles load
- [ ] API caching works
- [ ] Notifications work
- [ ] Error boundary works
- [ ] Service Worker active
- [ ] Offline mode works

## Issues Found:
1. [Issue description]
2. [Issue description]

## Screenshots:
[Attach screenshots]

## Notes:
[Any additional observations]
```

---

**Happy Testing! 🎬🍿**

Als je issues vindt, check de Console en Network tab voor details!
