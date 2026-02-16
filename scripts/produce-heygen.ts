/**
 * HeyGen Avatar IV Video Production Script for Support Portal Series
 *
 * Uses AV4 API (single-scene per call) + ffmpeg for PIP compositing,
 * concatenation, and watermark overlay.
 *
 * Adapted from the Radar onboarding series production script.
 *
 * Usage:
 *   npx tsx scripts/produce-heygen.ts --upload         Upload screen recordings as assets
 *   npx tsx scripts/produce-heygen.ts --produce        Submit all scenes to AV4
 *   npx tsx scripts/produce-heygen.ts --produce=1      Submit scenes for specific video (1-6)
 *   npx tsx scripts/produce-heygen.ts --status         Check status of all scenes
 *   npx tsx scripts/produce-heygen.ts --download       Download completed scene videos
 *   npx tsx scripts/produce-heygen.ts --stitch         FFmpeg: PIP composite + concatenate scenes
 *   npx tsx scripts/produce-heygen.ts --watermark      FFmpeg: apply Funnelists watermark
 *   npx tsx scripts/produce-heygen.ts --all            Run full pipeline
 *
 * Screen recordings: Run against localhost dev server (npm run dev) which uses
 * the mock layer — consistent data, no API key needed, fast responses.
 *
 * Portal URL for recordings: http://localhost:5173/#/login
 * Test accounts (mock): rose@edge.com / Admin123! (Super Admin)
 *                        sean@edge.com / User1234! (Regular User)
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── Configuration ───────────────────────────────────────────────────────────

// Load API key from agentpm's .env.local (shared HeyGen account)
const envPath = path.resolve('c:/dev/funnelists/agentpm/.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const apiKeyMatch = envContent.match(/VITE_HEYGEN_API_KEY="?([^"\n]+)/)
const API_KEY = apiKeyMatch?.[1]?.trim()
if (!API_KEY) {
  console.error('Missing VITE_HEYGEN_API_KEY in agentpm/.env.local')
  process.exit(1)
}

const HEYGEN_API = 'https://api.heygen.com'
const HEYGEN_UPLOAD = 'https://upload.heygen.com'

// Avatar IV configuration — Sophia (custom photo avatar) + Rose voice
// Same avatar/voice as Radar series for brand consistency
const IMAGE_KEY = 'image/1080a737263747ecb7d47125499d4123/original.jpg' // Sophia landscape 16:9
const VOICE_ID = '6b65220d835042af96bc77336439aadf' // Rose - UGC - 1
const MOTION_PROMPT = 'Natural head movements, subtle nods, engaged facial expressions, slight shoulder movement'
const DIMENSION = { width: 1280, height: 720 }

// FFmpeg path (winget install location)
const FFMPEG_BIN = 'C:/Users/troy/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.0.1-full_build/bin'
const FFMPEG = path.join(FFMPEG_BIN, 'ffmpeg.exe')
const FFPROBE = path.join(FFMPEG_BIN, 'ffprobe.exe')

// Paths
const RECORDINGS_DIR = path.resolve(__dirname, '../recordings')
const OUTPUT_DIR = path.resolve(RECORDINGS_DIR, 'heygen-output')
const SCENES_DIR = path.resolve(OUTPUT_DIR, 'scenes')
const FINAL_DIR = path.resolve(OUTPUT_DIR, 'final')
const STATE_FILE = path.resolve(RECORDINGS_DIR, 'heygen-state.json')
// Reuse assets from agentpm recordings
const WATERMARK_FILE = path.resolve('c:/dev/funnelists/agentpm/recordings/watermark-white.png')
const CIRCLE_MASK_FILE = path.resolve('c:/dev/funnelists/agentpm/recordings/circle-mask.png')

// ─── Types ───────────────────────────────────────────────────────────────────

interface Scene {
  /** 'head' = full avatar on dark bg, 'pip' = avatar PIP over screen recording */
  layout: 'head' | 'pip'
  /** Text the avatar will speak */
  text: string
  /** Start offset (seconds) into the screen recording for PIP scenes */
  recording_offset?: number
}

interface VideoDefinition {
  title: string
  /** Path to .webm recording relative to recordings dir */
  recording: string
  scenes: Scene[]
}

interface SceneState {
  video_id: string
  status: string
  url?: string
}

interface HeyGenState {
  assets: Record<string, string>
  scenes: Record<string, SceneState>
}

// ─── Video Definitions ───────────────────────────────────────────────────────

const VIDEOS: Record<string, VideoDefinition> = {
  welcomeOverview: {
    title: 'Support Portal — Welcome Overview',
    recording: 'welcomeOverview/welcomeOverview-recording.webm',
    scenes: [
      {
        layout: 'head',
        text: `Hey there. Welcome to the Funnelists Support Portal... a modern, self-service support experience built right on top of Salesforce. I'm going to give you a quick tour so you can see everything it offers.`
      },
      {
        layout: 'pip',
        recording_offset: 8, // After login, dashboard visible
        text: `After logging in, you land on your personalized dashboard. At the top, you see your case stats at a glance... open cases, closed cases, and total cases. There's a search bar that lets you find help articles instantly. Below that are quick-action cards to get to any section in one click.`
      },
      {
        layout: 'pip',
        recording_offset: 28, // Scrolling dashboard, product articles
        text: `Scroll down and you'll see Popular Articles organized by product. You can filter by product to find exactly what you need. And at the bottom, your most recent cases so you can pick up right where you left off.`
      },
      {
        layout: 'head',
        text: `The portal is fully branded with your company's logo, colors, and domain. Your customers see your brand... not ours. Let's dive deeper into the features. I'll show you how cases work next.`
      }
    ]
  },

  managingCases: {
    title: 'Support Portal — Managing Cases',
    recording: 'managingCases/managingCases-recording.webm',
    scenes: [
      {
        layout: 'pip',
        recording_offset: 6, // Case list loaded
        text: `Let's look at cases. This is where your customers interact with your support team. The case list shows all their cases with status badges, priorities, and timestamps. You can filter by status... open, closed, or all.`
      },
      {
        layout: 'pip',
        recording_offset: 18, // Inside a case detail
        text: `Click into any case to see the full conversation. Comments appear in a threaded timeline with timestamps. Your team's replies are clearly distinguished from customer messages. You can add comments, and they flow right into Salesforce.`
      },
      {
        layout: 'pip',
        recording_offset: 32, // Showing attachments / new case
        text: `Attachments are fully supported... images, videos, PDFs, documents. Customers can paste screenshots directly from their clipboard, drag and drop files, or use the upload button. Video attachments even play inline. Creating a new case is simple... pick a subject, set the priority, describe the issue, and submit. It routes into Salesforce instantly.`
      },
      {
        layout: 'head',
        text: `Every case, comment, and attachment syncs natively with Salesforce Service Cloud. Your agents work in the tools they already know, while your customers get a modern self-service experience.`
      }
    ]
  },

  helpAndIdeas: {
    title: 'Support Portal — Help & Ideas',
    recording: 'helpAndIdeas/helpAndIdeas-recording.webm',
    scenes: [
      {
        layout: 'pip',
        recording_offset: 6, // Help page loaded
        text: `The Help section gives your customers a searchable library of FAQs organized by category. They can expand any section to find answers, or use the search bar to find exactly what they're looking for. These FAQs can be hand-written by your team... or generated by AI. I'll show you how that works in the admin tools video.`
      },
      {
        layout: 'pip',
        recording_offset: 22, // Ideas page
        text: `The Ideas page turns your portal into a feedback loop. Customers submit feature requests and product ideas. Other users can vote on the ideas they care about... giving your team clear signal on what matters most. It's a simple, powerful way to prioritize your roadmap based on real customer input.`
      },
      {
        layout: 'head',
        text: `Help and Ideas work together to reduce support volume. When customers can find their own answers and feel heard through the ideas process, fewer tickets come in... and the ones that do are higher quality.`
      }
    ]
  },

  knowledgeBase: {
    title: 'Support Portal — Knowledge Base',
    recording: 'knowledgeBase/knowledgeBase-recording.webm',
    scenes: [
      {
        layout: 'head',
        text: `Let's talk about the Knowledge Base. A great support portal doesn't just let customers file tickets... it helps them find answers on their own. The Support Portal ships with a full knowledge system powered by Salesforce.`
      },
      {
        layout: 'pip',
        recording_offset: 6, // Knowledge base browsing, categories visible
        text: `Articles are organized by product and category... Getting Started, Troubleshooting, Features, Integrations, and more. Customers can browse by topic or search across the entire library. Each article is structured with clear headings, step-by-step instructions, and relevant details.`
      },
      {
        layout: 'pip',
        recording_offset: 20, // Searching, article detail view
        text: `The search is fast and filters results in real time. Click into any article to see the full content. Articles are stored in Salesforce Knowledge... so your team manages them with the tools they already know. Publish, update, or archive articles from Salesforce Setup, and the portal reflects changes immediately.`
      },
      {
        layout: 'head',
        text: `Knowledge articles also power the AI. When customers ask the AI Assistant a question, it pulls from your published articles and FAQs for grounding... so answers are accurate, contextual, and specific to your products. The more you invest in your knowledge base, the smarter your entire support experience becomes.`
      }
    ]
  },

  aiAssistant: {
    title: 'Support Portal — AI Assistant',
    recording: 'aiAssistant/aiAssistant-recording.webm',
    scenes: [
      {
        layout: 'head',
        text: `Now let's talk about the AI Assistant. This is a bring-your-own-key LLM chat... powered by Claude or OpenAI, whichever your team prefers. It's not a generic chatbot. It knows your products, your FAQs, and your support patterns.`
      },
      {
        layout: 'pip',
        recording_offset: 8, // Chat widget open
        text: `Click the chat button in the bottom corner to open the assistant. Ask a question in natural language... and the AI responds using your help content and case history as grounding context. It pulls from your published FAQs and recent cases to give accurate, relevant answers. If it can't answer, it guides customers to create a support case.`
      },
      {
        layout: 'head',
        text: `The AI Assistant is configured by admins in Portal Settings. Choose your provider... Claude or OpenAI. Enter your API key. Select your model. It's fully bring-your-own-key, so you control the costs and the provider relationship. Available to admin users, and can be toggled on or off anytime.`
      }
    ]
  },

  adminTools: {
    title: 'Support Portal — Admin Tools',
    recording: 'adminTools/adminTools-recording.webm',
    scenes: [
      {
        layout: 'head',
        text: `Let's look at the admin side. Portal Admins and Super Admins get a full management suite with five powerful tools. Let me walk you through each one.`
      },
      {
        layout: 'pip',
        recording_offset: 6, // Admin dashboard
        text: `The Admin Dashboard gives you a bird's eye view... total users, active users, pending registrations, and case stats. User Management lets you search users by name or email, activate or deactivate accounts, and assign roles. Three roles are available... User, Portal Admin, and Super Admin.`
      },
      {
        layout: 'pip',
        recording_offset: 24, // FAQ Generator
        text: `The FAQ Manager is where AI meets content. Paste any document... a product guide, a troubleshooting doc, release notes... and the AI generates FAQ question-and-answer pairs automatically. Review each one, edit if needed, and publish with a single click. Published FAQs go live on the Help page instantly.`
      },
      {
        layout: 'pip',
        recording_offset: 40, // Portal Settings
        text: `Portal Settings is your command center. Configure the AI provider and model, set the chat mode, manage branding, and control which features are visible in the portal. Branding even lets you extract your website's look and feel with a single URL. Everything saves to Salesforce, so your settings persist.`
      },
      {
        layout: 'head',
        text: `All of these admin tools are available right in the portal... no switching to Salesforce Setup. But if you prefer, there's also a dedicated Lightning App in Salesforce for managing portal data directly.`
      }
    ]
  },

  agentforceIntegration: {
    title: 'Support Portal — Agentforce Integration',
    recording: 'agentforceIntegration/agentforceIntegration-recording.webm',
    scenes: [
      {
        layout: 'head',
        text: `Let's talk about something that makes this portal unique... deep Agentforce integration. The Support Portal supports three distinct chat modes, all configurable from Portal Settings... no code changes required.`
      },
      {
        layout: 'pip',
        recording_offset: 6, // Portal Settings showing mode selector
        text: `Mode one is the Built-in Assistant... a lightweight keyword-based helper that runs entirely in the browser. Mode two is Salesforce Messaging for Web... which connects to a real Agentforce Service Agent. Customers chat with an AI agent that can look up cases, search your knowledge base, and escalate to a live agent when needed. Mode three is the AI Assistant with your own LLM key... Claude or OpenAI.`
      },
      {
        layout: 'pip',
        recording_offset: 22, // Salesforce side - Lightning App, cases
        text: `On the Salesforce side, everything is native. Cases, contacts, comments, attachments... all standard Salesforce objects. There's a dedicated Lightning App with custom tabs for managing FAQs, Ideas, Themes, and Sessions. Your Agentforce agent can be grounded with a Data Library of product documentation for accurate, contextual responses.`
      },
      {
        layout: 'head',
        text: `The Funnelists Support Portal. Branded, intelligent, and built on Salesforce with native Agentforce integration. Whether your team uses Claude, OpenAI, or Salesforce Agentforce... the portal adapts to your stack. Visit funnelists.com or reach out to schedule a demo. Thanks for watching.`
      }
    ]
  },

  // ─── Sizzle Clips (short marketing/sales demos) ───────────────────────────

  themeImporter: {
    title: 'Support Portal — Theme & Style Importer',
    recording: 'themeImporter/themeImporter-recording.webm',
    scenes: [
      {
        layout: 'head',
        text: `Want to see something cool? The Support Portal can import your brand identity from any website... automatically. Just paste a URL and watch.`
      },
      {
        layout: 'pip',
        recording_offset: 4, // Admin entering URL, extraction happening
        text: `In Portal Settings, paste your website URL and hit Extract. The portal scans your site and pulls your logo, primary colors, background colors, and font choices. You see a live preview instantly... your portal, your brand, in seconds. Adjust anything you want, then save. The theme applies across every page of the portal. Your customers never see a generic interface... they see you.`
      },
      {
        layout: 'head',
        text: `No design tools. No CSS. No tickets to your dev team. Just paste a URL and your support portal looks like it was built in-house. That's the Theme and Style Importer.`
      }
    ]
  },

  docToFaq: {
    title: 'Support Portal — Doc-to-FAQ Import',
    recording: 'docToFaq/docToFaq-recording.webm',
    scenes: [
      {
        layout: 'head',
        text: `Building out a help center usually takes weeks. Writing FAQ articles, organizing categories, reviewing content... it's a grind. What if you could skip all of that? The Support Portal lets you turn any document into a published FAQ library in under a minute.`
      },
      {
        layout: 'pip',
        recording_offset: 4, // FAQ Manager, pasting a document
        text: `Open the FAQ Manager, paste your document... a product guide, release notes, a troubleshooting doc, anything. Hit Generate, and the AI reads the entire document and produces structured question-and-answer pairs. Each one is categorized automatically. Review the results, edit any you want to fine-tune, then publish with a single click. Flip over to the Help page... and they're live. Your customers can search and browse them immediately.`
      },
      {
        layout: 'head',
        text: `Here's the best part. Those published FAQs don't just sit on a page. They become grounding context for your AI... whether you're using Agentforce, Claude, OpenAI, or your own trained model. Upload your docs, and every AI touchpoint in the portal gets smarter. One import powers your entire self-service experience.`
      }
    ]
  },

  screenCapture: {
    title: 'Support Portal — Screen Recording',
    recording: 'screenCapture/screenCapture-recording.webm',
    scenes: [
      {
        layout: 'head',
        text: `Every support team knows the pain. A customer says something is broken, but the description doesn't capture it. Three emails later, you're still guessing. The Support Portal eliminates that entirely with a built-in screen recorder.`
      },
      {
        layout: 'pip',
        recording_offset: 4, // Case form with Record button, recording flow
        text: `When submitting a case, click the Record Screen button. The browser asks which screen or tab to share... select it, and you're recording. Reproduce the issue while the portal captures everything. Click Stop, and the recording is automatically attached to the case. No separate tools. No file exports. No uploading. Your support agent opens the case and sees the exact issue, in motion, in context. They can play the video right inside the case detail view.`
      },
      {
        layout: 'head',
        text: `One click to record. One click to stop. The video is on the case. It saves time for the customer, saves time for the agent, and gets issues resolved faster. No more back and forth trying to describe what went wrong... just show it.`
      }
    ]
  }
}

// ─── State Management ────────────────────────────────────────────────────────

function loadState(): HeyGenState {
  if (fs.existsSync(STATE_FILE)) {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
    return { assets: raw.assets || {}, scenes: raw.scenes || {} }
  }
  return { assets: {}, scenes: {} }
}

function saveState(state: HeyGenState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function sceneKey(flowName: string, idx: number): string {
  return `${flowName}_scene_${idx}`
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function heygenGet(endpoint: string) {
  const res = await fetch(`${HEYGEN_API}${endpoint}`, {
    headers: { 'x-api-key': API_KEY! }
  })
  return res.json()
}

async function heygenPost(endpoint: string, body: unknown) {
  const res = await fetch(`${HEYGEN_API}${endpoint}`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  return { status: res.status, json: await res.json() }
}

async function uploadAsset(filePath: string, contentType: string): Promise<{ id: string; url: string }> {
  const data = fs.readFileSync(filePath)
  const res = await fetch(`${HEYGEN_UPLOAD}/v1/asset`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY!,
      'Content-Type': contentType
    },
    body: data
  })
  const json = await res.json() as { code: number; data: { id: string; url: string }; message: string | null }
  if (json.code !== 100) {
    throw new Error(`Upload failed: ${JSON.stringify(json)}`)
  }
  return json.data
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdUpload() {
  console.log('Uploading screen recordings to HeyGen...\n')
  const state = loadState()

  for (const [flowName, video] of Object.entries(VIDEOS)) {
    const filePath = path.join(RECORDINGS_DIR, video.recording)
    if (!fs.existsSync(filePath)) {
      console.log(`  SKIP ${flowName}: Recording not found at ${filePath}`)
      continue
    }

    if (state.assets[flowName]) {
      console.log(`  OK   ${flowName}: Already uploaded (asset: ${state.assets[flowName]})`)
      continue
    }

    const stats = fs.statSync(filePath)
    console.log(`  UP   ${flowName}: Uploading ${(stats.size / 1024 / 1024).toFixed(1)}MB...`)

    try {
      const result = await uploadAsset(filePath, 'video/webm')
      state.assets[flowName] = result.id
      saveState(state)
      console.log(`  OK   ${flowName}: Uploaded (asset: ${result.id})`)
    } catch (err) {
      console.error(`  FAIL ${flowName}: Upload failed:`, err)
    }
  }

  console.log('\nDone. Asset IDs saved to heygen-state.json')
}

async function cmdProduce(videoNum?: number) {
  const state = loadState()
  const entries = Object.entries(VIDEOS)

  const toProcess = videoNum
    ? [entries[videoNum - 1]]
    : entries

  if (!toProcess[0]) {
    console.error(`Invalid video number: ${videoNum}. Must be 1-${entries.length}`)
    process.exit(1)
  }

  fs.mkdirSync(SCENES_DIR, { recursive: true })

  console.log('Submitting scenes to HeyGen AV4...\n')

  let submitted = 0
  let skipped = 0

  for (const [flowName, video] of toProcess) {
    console.log(`\n--- ${flowName}: "${video.title}" (${video.scenes.length} scenes) ---`)

    for (let i = 0; i < video.scenes.length; i++) {
      const key = sceneKey(flowName, i)
      const scene = video.scenes[i]

      if (state.scenes[key]?.video_id) {
        console.log(`  OK   scene ${i}: Already submitted (${state.scenes[key].video_id})`)
        skipped++
        continue
      }

      const payload = {
        image_key: IMAGE_KEY,
        script: scene.text,
        voice_id: VOICE_ID,
        video_title: `${video.title} - Scene ${i + 1}`,
        dimension: DIMENSION,
        custom_motion_prompt: MOTION_PROMPT
      }

      console.log(`  SUB  scene ${i} (${scene.layout}): "${scene.text.slice(0, 60)}..."`)

      try {
        const { status, json } = await heygenPost('/v2/video/av4/generate', payload)
        const result = json as { error?: string; data?: { video_id: string } }

        if (result.data?.video_id) {
          state.scenes[key] = { video_id: result.data.video_id, status: 'pending' }
          saveState(state)
          console.log(`  OK   scene ${i}: video_id=${result.data.video_id}`)
          submitted++
        } else {
          console.error(`  FAIL scene ${i}: HTTP ${status}`, JSON.stringify(result))
        }
      } catch (err) {
        console.error(`  FAIL scene ${i}:`, err)
      }

      // Brief pause between submissions to avoid rate limiting
      if (i < video.scenes.length - 1) {
        await new Promise(r => setTimeout(r, 500))
      }
    }
  }

  console.log(`\nDone. Submitted: ${submitted}, Skipped: ${skipped}`)
  console.log('Run --status to check progress.')
}

async function cmdStatus(): Promise<boolean> {
  const state = loadState()
  console.log('Scene Status:\n')

  let pending = 0
  let completed = 0
  let failed = 0

  for (const [key, info] of Object.entries(state.scenes)) {
    if (info.status === 'completed' && info.url) {
      completed++
      continue
    }

    try {
      const result = await heygenGet(`/v1/video_status.get?video_id=${info.video_id}`) as {
        error?: string | null
        data?: { status: string; video_url?: string; duration?: number; error?: string }
      }

      const s = result.data?.status || 'unknown'
      state.scenes[key].status = s

      if (s === 'completed' && result.data?.video_url) {
        state.scenes[key].url = result.data.video_url
        const dur = result.data.duration ? ` (${result.data.duration.toFixed(1)}s)` : ''
        console.log(`  DONE ${key}${dur}`)
        completed++
      } else if (s === 'failed') {
        console.log(`  FAIL ${key}: ${result.data?.error || 'unknown error'}`)
        failed++
      } else {
        console.log(`  WAIT ${key}: ${s}`)
        pending++
      }
    } catch (err) {
      console.error(`  ERR  ${key}:`, err)
      pending++
    }
  }

  saveState(state)

  const total = Object.keys(state.scenes).length
  console.log(`\nTotal: ${total} | Completed: ${completed} | Pending: ${pending} | Failed: ${failed}`)

  if (pending === 0 && total > 0) {
    console.log('\nAll scenes finished! Run --download then --stitch.')
    return true
  }
  return false
}

async function cmdDownload() {
  const state = loadState()
  fs.mkdirSync(SCENES_DIR, { recursive: true })

  console.log('Downloading completed scenes...\n')

  // Refresh statuses first
  for (const [key, info] of Object.entries(state.scenes)) {
    if (info.status !== 'completed' || !info.url) {
      const result = await heygenGet(`/v1/video_status.get?video_id=${info.video_id}`) as {
        data?: { status: string; video_url?: string }
      }
      if (result.data?.status === 'completed' && result.data.video_url) {
        state.scenes[key].status = 'completed'
        state.scenes[key].url = result.data.video_url
      }
    }
  }
  saveState(state)

  for (const [key, info] of Object.entries(state.scenes)) {
    if (info.status !== 'completed' || !info.url) {
      console.log(`  SKIP ${key}: Not ready (${info.status})`)
      continue
    }

    const outputPath = path.join(SCENES_DIR, `${key}.mp4`)
    if (fs.existsSync(outputPath)) {
      console.log(`  OK   ${key}: Already downloaded`)
      continue
    }

    console.log(`  DL   ${key}...`)
    try {
      const res = await fetch(info.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buffer = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync(outputPath, buffer)
      console.log(`  OK   ${key}: ${(buffer.length / 1024 / 1024).toFixed(1)}MB`)
    } catch (err) {
      console.error(`  FAIL ${key}:`, err)
    }
  }

  console.log(`\nDone. Scene videos saved to ${SCENES_DIR}`)
}

async function cmdStitch() {
  console.log('Stitching videos with FFmpeg...\n')

  fs.mkdirSync(FINAL_DIR, { recursive: true })

  for (const [flowName, video] of Object.entries(VIDEOS)) {
    const outputPath = path.join(FINAL_DIR, `${flowName}.mp4`)
    if (fs.existsSync(outputPath)) {
      console.log(`  OK   ${flowName}: Already stitched`)
      continue
    }

    // Check all scenes exist
    const sceneFiles: string[] = []
    let missing = false
    for (let i = 0; i < video.scenes.length; i++) {
      const scenePath = path.join(SCENES_DIR, `${sceneKey(flowName, i)}.mp4`)
      if (!fs.existsSync(scenePath)) {
        console.log(`  SKIP ${flowName}: Missing scene ${i} (${scenePath})`)
        missing = true
        break
      }
      sceneFiles.push(scenePath)
    }
    if (missing) continue

    console.log(`  PROC ${flowName}: ${video.scenes.length} scenes...`)

    // Step 1: Process each scene — PIP scenes get avatar overlay on screen recording
    const processedFiles: string[] = []
    const recordingPath = path.join(RECORDINGS_DIR, video.recording)
    const hasRecording = fs.existsSync(recordingPath)

    for (let i = 0; i < video.scenes.length; i++) {
      const scene = video.scenes[i]
      const sceneFile = sceneFiles[i]
      const processedPath = path.join(SCENES_DIR, `${sceneKey(flowName, i)}-processed.mp4`)

      if (fs.existsSync(processedPath)) {
        processedFiles.push(processedPath)
        continue
      }

      if (scene.layout === 'pip' && hasRecording) {
        // PIP: circular avatar overlay (280px) bottom-right on screen recording
        const probeCmd = `"${FFPROBE}" -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${sceneFile}"`
        let duration: number
        try {
          duration = parseFloat(execSync(probeCmd, { encoding: 'utf-8' }).trim())
        } catch {
          console.log(`    WARN: Could not probe duration for scene ${i}, using scene as-is`)
          processedFiles.push(sceneFile)
          continue
        }

        const recOffset = scene.recording_offset || 0
        const pipCmd = [
          `"${FFMPEG}" -y`,
          `-i "${recordingPath}"`,
          `-i "${sceneFile}"`,
          `-i "${CIRCLE_MASK_FILE}"`,
          `-filter_complex "`,
          `[0:v]trim=start=${recOffset.toFixed(2)}:duration=${(duration + 5).toFixed(2)},setpts=PTS-STARTPTS,`,
          `tpad=stop_mode=clone:stop_duration=30,`,
          `trim=duration=${duration.toFixed(2)},setpts=PTS-STARTPTS,`,
          `scale=1280:720,setsar=1[bg];`,
          `[1:v]crop=360:360:180:60,scale=280:280[av_sq];`,
          `[2:v]scale=280:280[mask];`,
          `[av_sq][mask]alphamerge[av_circle];`,
          `[bg][av_circle]overlay=W-w-30:H-h-30[out]`,
          `"`,
          `-map "[out]"`,
          `-map 1:a`,
          `-c:v libx264 -preset medium -crf 18`,
          `-c:a aac -b:a 128k`,
          `-r 30`,
          `"${processedPath}"`
        ].join(' ')

        try {
          execSync(pipCmd, { stdio: 'pipe', timeout: 120000 })
          processedFiles.push(processedPath)
          console.log(`    PIP  scene ${i}: composited`)
        } catch (err: any) {
          console.log(`    WARN scene ${i}: PIP failed, using avatar-only. ${err.stderr?.toString().slice(-200) || ''}`)
          const normCmd = `"${FFMPEG}" -y -i "${sceneFile}" -vf "pad=1280:720:(1280-720)/2:0:black,setsar=1" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 128k -r 30 "${processedPath}"`
          try {
            execSync(normCmd, { stdio: 'pipe', timeout: 60000 })
            processedFiles.push(processedPath)
          } catch {
            processedFiles.push(sceneFile)
          }
        }
      } else {
        // Head scene: pad to 1280x720 with black pillarbox bars
        const normCmd = `"${FFMPEG}" -y -i "${sceneFile}" -vf "pad=1280:720:(1280-720)/2:0:black,setsar=1" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 128k -r 30 "${processedPath}"`
        try {
          execSync(normCmd, { stdio: 'pipe', timeout: 60000 })
          processedFiles.push(processedPath)
          console.log(`    NORM scene ${i}: normalized`)
        } catch {
          processedFiles.push(sceneFile)
        }
      }
    }

    // Step 2: Concatenate with fade transitions
    const FADE_DURATION = 0.3

    const durations: number[] = processedFiles.map(f => {
      const cmd = `"${FFPROBE}" -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${f}"`
      try {
        return parseFloat(execSync(cmd, { encoding: 'utf-8' }).trim())
      } catch {
        return 10
      }
    })

    try {
      if (processedFiles.length === 1) {
        fs.copyFileSync(processedFiles[0], outputPath)
      } else {
        const inputs = processedFiles.map(f => `-i "${f}"`).join(' ')
        const fadeFilters: string[] = []

        for (let j = 0; j < processedFiles.length; j++) {
          const fadeOut = `fade=t=out:st=${(durations[j] - FADE_DURATION).toFixed(3)}:d=${FADE_DURATION}`
          const fadeIn = `fade=t=in:d=${FADE_DURATION}`

          if (j === 0) {
            fadeFilters.push(`[${j}:v]${fadeOut}[v${j}]`)
          } else if (j === processedFiles.length - 1) {
            fadeFilters.push(`[${j}:v]${fadeIn}[v${j}]`)
          } else {
            fadeFilters.push(`[${j}:v]${fadeIn},${fadeOut}[v${j}]`)
          }
        }

        const concatInputs = Array.from({ length: processedFiles.length }, (_, j) => `[v${j}][${j}:a]`).join('')
        const concatFilter = `${concatInputs}concat=n=${processedFiles.length}:v=1:a=1[vout][aout]`

        const filterComplex = [...fadeFilters, concatFilter].join(';')
        const stitchCmd = [
          `"${FFMPEG}" -y`,
          inputs,
          `-filter_complex "${filterComplex}"`,
          `-map "[vout]" -map "[aout]"`,
          `-c:v libx264 -preset medium -crf 18`,
          `-c:a aac -b:a 128k`,
          `"${outputPath}"`
        ].join(' ')

        execSync(stitchCmd, { stdio: 'pipe', timeout: 180000 })
      }

      const stats = fs.statSync(outputPath)
      console.log(`  OK   ${flowName}: Stitched (${(stats.size / 1024 / 1024).toFixed(1)}MB)`)
    } catch (err: any) {
      console.error(`  FAIL ${flowName}: Stitch failed. ${err.stderr?.toString().slice(-200) || ''}`)
    }
  }

  console.log(`\nDone. Stitched videos in ${FINAL_DIR}`)
}

async function cmdWatermark() {
  console.log('Applying watermark...\n')

  if (!fs.existsSync(WATERMARK_FILE)) {
    console.error(`Watermark not found: ${WATERMARK_FILE}`)
    console.log('Ensure watermark-white.png exists in agentpm/recordings/')
    process.exit(1)
  }

  for (const flowName of Object.keys(VIDEOS)) {
    const inputPath = path.join(FINAL_DIR, `${flowName}.mp4`)
    const outputPath = path.join(FINAL_DIR, `${flowName}-watermarked.mp4`)

    if (!fs.existsSync(inputPath)) {
      console.log(`  SKIP ${flowName}: No stitched video`)
      continue
    }

    if (fs.existsSync(outputPath)) {
      console.log(`  OK   ${flowName}: Already watermarked`)
      continue
    }

    const wmCmd = [
      `"${FFMPEG}" -y`,
      `-i "${inputPath}"`,
      `-i "${WATERMARK_FILE}"`,
      `-filter_complex "`,
      `[1:v]scale=200:-1,format=rgba,colorchannelmixer=aa=0.20[wm];`,
      `[0:v][wm]overlay=W-w-15:H-h-15[out]`,
      `"`,
      `-map "[out]" -map 0:a`,
      `-c:v libx264 -preset medium -crf 18`,
      `-c:a copy`,
      `"${outputPath}"`
    ].join(' ')

    console.log(`  WM   ${flowName}...`)
    try {
      execSync(wmCmd, { stdio: 'pipe', timeout: 120000 })
      const stats = fs.statSync(outputPath)
      console.log(`  OK   ${flowName}: ${(stats.size / 1024 / 1024).toFixed(1)}MB`)
    } catch (err: any) {
      console.error(`  FAIL ${flowName}: ${err.stderr?.toString().slice(-200) || ''}`)
    }
  }

  console.log(`\nDone. Final watermarked videos in ${FINAL_DIR}`)
}

async function cmdAll() {
  console.log('=== Full Production Pipeline ===\n')

  await cmdProduce()

  console.log('\n--- Polling for completion... ---\n')
  let allDone = false
  let polls = 0
  while (!allDone && polls < 60) {
    await new Promise(r => setTimeout(r, 30000))
    polls++
    console.log(`\n--- Status check ${polls} ---\n`)
    allDone = await cmdStatus()
  }

  if (!allDone) {
    console.log('\nTimed out waiting for completion. Run --status manually.')
    return
  }

  console.log('\n--- Downloading scenes ---\n')
  await cmdDownload()

  console.log('\n--- Stitching ---\n')
  await cmdStitch()

  console.log('\n--- Watermarking ---\n')
  await cmdWatermark()

  console.log('\n=== Pipeline complete! ===')
  console.log(`Final videos: ${FINAL_DIR}`)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0] || '--help'

  if (cmd === '--upload') {
    await cmdUpload()
  } else if (cmd.startsWith('--produce')) {
    const match = cmd.match(/--produce=(\d+)/)
    await cmdProduce(match ? parseInt(match[1]) : undefined)
  } else if (cmd === '--status') {
    await cmdStatus()
  } else if (cmd === '--download') {
    await cmdDownload()
  } else if (cmd === '--stitch') {
    await cmdStitch()
  } else if (cmd === '--watermark') {
    await cmdWatermark()
  } else if (cmd === '--all') {
    await cmdAll()
  } else {
    const totalScenes = Object.values(VIDEOS).reduce((sum, v) => sum + v.scenes.length, 0)
    console.log(`
HeyGen Avatar IV Production Script — Support Portal Series

Usage:
  npx tsx scripts/produce-heygen.ts <command>

Commands:
  --upload          Upload screen recordings as HeyGen assets
  --produce         Submit all ${totalScenes} scenes to AV4 for generation
  --produce=N       Submit scenes for video N (1-6) only
  --status          Check scene generation status
  --download        Download completed scene videos
  --stitch          FFmpeg: PIP composite + concatenate into final videos
  --watermark       FFmpeg: apply Funnelists watermark
  --all             Full pipeline: produce -> poll -> download -> stitch -> watermark

Workflow:
  1. Record screen flows for each video (Playwright or manual)
  2. npx tsx scripts/produce-heygen.ts --upload       (upload recordings)
  3. npx tsx scripts/produce-heygen.ts --produce      (submit ${totalScenes} AV4 scenes)
  4. npx tsx scripts/produce-heygen.ts --status       (repeat until all done)
  5. npx tsx scripts/produce-heygen.ts --download     (download scene MP4s)
  6. npx tsx scripts/produce-heygen.ts --stitch       (PIP + concat per video)
  7. npx tsx scripts/produce-heygen.ts --watermark    (logo overlay)

  Or: npx tsx scripts/produce-heygen.ts --all         (automated full pipeline)

Configuration:
  Avatar:    Sophia (custom photo avatar, landscape 16:9)
  Voice:     Rose - UGC - 1 (${VOICE_ID})
  Motion:    ${MOTION_PROMPT}
  Dimension: ${DIMENSION.width}x${DIMENSION.height}

Videos:
${Object.entries(VIDEOS).map(([name, v], i) => `  ${i + 1}. ${name}: ${v.title} (${v.scenes.length} scenes)`).join('\n')}

Total scenes: ${totalScenes}
    `)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
