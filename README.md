# PTZOptics Moondreams

**Visual Reasoning Demos for Video Production**

Welcome! This interactive demo shows how artificial intelligence can "see" and understand what's in your camera feed. Using a technique called **visual reasoning**, AI doesn't just detect objects—it actually interprets and thinks about what it sees. Whether you're a live streamer, video producer, or just curious about AI, these demos let you experience visual reasoning firsthand.

**[Try the Live Demo](https://matthewidavis.github.io/PTZOptics-Moondreams/)**

---

## What Is Visual Reasoning?

**Visual reasoning** is AI's ability to not just see an image, but to understand and think about it. Traditional computer vision simply recognizes patterns—"that's a cat." Visual reasoning goes further—"that's a cat sitting on a red couch, looking at something outside the window."

These demos use **MoonDream**, a visual reasoning model that can look at images and truly understand what's in them. Unlike chatbots that only work with text, MoonDream actually "sees" your webcam feed or uploaded images and can:

- Identify objects and people
- Count things in a scene
- Answer questions about what it sees
- Describe what's happening

This is the same type of technology used in self-driving cars, security systems, and smart cameras—but here you can play with it yourself!

---

## The Six Demos

### 1. Object Detector

**What it does:** You type in any object (like "coffee mug" or "chair") and the AI finds it in your image, drawing a colored box around each one it spots.

**Why it's useful:** Imagine a camera that automatically knows when a specific product appears on screen, or tracks where the host is sitting. This is how smart cameras can follow action without a human operator.

**Try this:** Point your webcam at your desk and search for "keyboard", "monitor", or "person". Watch how the AI outlines each object it finds.

---

### 2. Smart Counter

**What it does:** Tell it what to count ("people", "cars", "books") and it marks each one with a dot and gives you a total.

**Why it's useful:** Event producers use this to estimate crowd sizes. Retailers count customers. Warehouses track inventory. Instead of counting manually, AI does it instantly.

**Try this:** Hold up your hand and count "fingers". Or point at a bookshelf and count "books". The AI places a marker on each item it finds.

---

### 3. Scene Analyzer

**What it does:** Two features in one:
- **Caption:** The AI writes a sentence describing your entire scene
- **Q&A:** You ask questions and the AI answers based on what it sees

**Why it's useful:** This demo best showcases visual reasoning—the AI doesn't just list objects, it understands context and relationships. This is how accessibility features describe images to visually impaired users. It's also how AI can automatically generate descriptions for video archives or social media posts.

**Try this:**
- Click "Caption" to see how the AI describes your room
- Ask questions like "What color is the wall?" or "How many people are in the room?"

---

### 4. Person Tracker

**What it does:** Automatically finds all people in the frame and draws boxes around them. Includes modes for finding faces specifically or detecting the full body.

**Why it's useful:** This is the foundation of "auto-tracking" PTZ cameras that follow speakers around a room. It's also used in video conferencing to keep participants centered in frame.

**Try this:** Turn on your webcam and select "All People" to see yourself outlined. Try "Face Detection" mode to see just your face highlighted.

---

### 5. Zone Monitor

**What it does:** You draw custom zones on your video feed, then the AI watches for specific objects entering those zones. When something you're looking for appears in your zone, it alerts you.

**Why it's useful:** Security systems use this to detect when someone enters a restricted area. Sports broadcasts use it to know when a ball crosses a line. Production teams use it to trigger camera switches.

**Try this:**
1. Draw a zone by clicking to place points, then click "Finish Zone"
2. Enter "face" in the detection field
3. Start monitoring and move in/out of your drawn zone
4. Watch the alert status change!

---

### 6. Production Monitor

**What it does:** A comprehensive video production quality dashboard that combines traditional computer vision with MoonDream's visual reasoning. It monitors 7 different aspects of your shot in real-time:

| Monitor | Source | What It Checks |
|---------|--------|----------------|
| Orientation | MediaPipe | Is the subject facing the camera? |
| Talking | MediaPipe | Is the subject speaking? |
| Focus | OpenCV | Is the image sharp or blurry? |
| Lighting | Canvas | Is the scene properly exposed? |
| Presence | MoonDream | Is a face detected in frame? |
| Composition | MoonDream | Is the subject well-framed and positioned? |
| Scene Context | MoonDream | AI description of what's happening |

**Why it's useful:** This is the kind of automated quality control that broadcast engineers dream of. Instead of manually checking that a speaker is in frame, facing the camera, properly lit, and in focus—the AI monitors everything continuously and alerts you to problems.

**Try this:**
1. Start your webcam and click "Start Monitoring"
2. Watch the status cards turn green (good), yellow (warning), or red (problem)
3. Move around, look away from camera, or cover the lens to see how each monitor responds
4. Click any card to enable/disable that specific monitor
5. Read the Scene Description to see the AI's understanding of your shot

**The hybrid approach:** This demo showcases how traditional computer vision (MediaPipe for face landmarks, OpenCV for focus detection) can work alongside visual reasoning (MoonDream for presence, composition, and scene understanding). Fast client-side analysis handles real-time metrics, while MoonDream adds contextual intelligence.

---

## Getting Started

### What You'll Need

1. **A MoonDream API Key** (free)
   - Visit [moondream.ai](https://moondream.ai)
   - Create an account
   - Copy your API key

2. **A Webcam** (or images to upload)
   - Any built-in or USB webcam works
   - Or use the "Upload Image" button to analyze photos

### First-Time Setup

1. Open the demo: **[matthewidavis.github.io/PTZOptics-Moondreams](https://matthewidavis.github.io/PTZOptics-Moondreams/)**
2. Click the key icon and paste your MoonDream API key
3. Click "Start Webcam" to begin
4. Select any demo from the left sidebar

Your API key is saved in your browser and never shared with anyone except MoonDream's servers.

---

## How Does Visual Reasoning Work?

When you click "Detect" or "Analyze", here's what happens:

1. **Capture:** The demo takes a snapshot from your webcam
2. **Send:** That image is sent to MoonDream's AI servers
3. **Reason:** MoonDream's visual reasoning model analyzes the image—identifying objects, understanding spatial relationships, and interpreting context
4. **Return:** Results come back (usually in 1-3 seconds)
5. **Display:** Boxes, dots, or text are drawn on your screen

The AI model has been trained on millions of images to recognize objects, understand scenes, and answer questions. What makes visual reasoning special is that it connects vision with language—the AI can explain what it sees in natural language, not just output coordinates or labels.

---

## Tips for Best Results

- **Lighting matters:** Brighter, evenly-lit scenes work better than dark rooms
- **Be specific:** "red coffee mug" works better than just "thing"
- **Clear views:** Objects that are partially hidden are harder to detect
- **Steady camera:** Blurry images reduce accuracy
- **Try different words:** If "person" doesn't work, try "human" or "people"

---

## Understanding the Results

### Bounding Boxes
The colored rectangles show where the AI found objects. The box covers the full extent of the detected item.

### Confidence Isn't Shown
Unlike some AI tools, these demos don't show confidence percentages. If something is detected, it appears. If not, nothing shows. This keeps the interface clean and simple.

### Why Might Detection Fail?
- Object is too small in frame
- Poor lighting or image quality
- Unusual angle or partial view
- AI wasn't trained on that specific item
- Try different wording (e.g., "laptop" vs "computer")

---

## Privacy & Your Data

- **Your webcam feed stays local** until you click an action button
- **Images are processed, not stored** by MoonDream
- **Your API key stays in your browser** and is never sent to us
- **No accounts required** to use these demos
- **Works offline?** No—AI processing requires internet connection to MoonDream's servers

---

## About the Technology

**MoonDream** is a visual reasoning model (also called a vision-language model), meaning it understands both images and text together. This lets it answer open-ended questions about what it sees, rather than just detecting pre-defined categories. Visual reasoning bridges the gap between seeing and understanding.

**PTZOptics** creates professional PTZ (pan-tilt-zoom) cameras for live streaming, broadcasting, and video production. These demos explore how visual reasoning can enhance camera automation and production workflows—imagine cameras that don't just track motion, but understand what's happening in a scene.

---

## Questions?

- **MoonDream API:** [docs.moondream.ai](https://docs.moondream.ai)
- **PTZOptics:** [ptzoptics.com](https://ptzoptics.com)
- **Issues with this demo:** [GitHub Issues](https://github.com/matthewidavis/PTZOptics-Moondreams/issues)

---

*Built with MoonDream AI and designed for video production enthusiasts, educators, and anyone curious about visual reasoning and computer vision.*
