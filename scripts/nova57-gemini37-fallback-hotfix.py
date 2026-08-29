from pathlib import Path

path = Path('fresh-rebuild/src/nova57-pro-keyless-router.js')
text = path.read_text()

anchor = "async function firebaseFallback() {\n  if (!firebaseModule) firebaseModule = import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js?nova-pro-original=1');\n  return firebaseModule;\n}\n"
helper = anchor + "\nfunction firebaseCompatibleOptions(options = {}, modelOverride = '') {\n  const source = options?.generationConfig || {};\n  const generationConfig = { ...source };\n  delete generationConfig.temperature;\n  delete generationConfig.topP;\n  delete generationConfig.topK;\n  const result = { ...options, generationConfig };\n  if (modelOverride) result.model = modelOverride;\n  return result;\n}\n"
if 'function firebaseCompatibleOptions(' not in text:
    if anchor not in text:
        raise SystemExit('Firebase fallback anchor missing')
    text = text.replace(anchor, helper, 1)

old = "          const originalAI = mod.getAI(ai?.firebaseApp, { backend: new mod.GoogleAIBackend() });\n          return await mod.getGenerativeModel(originalAI, options).generateContent(prompt);"
new = "          const originalAI = mod.getAI(ai?.firebaseApp, { backend: new mod.GoogleAIBackend() });\n          const primaryOptions = firebaseCompatibleOptions(options);\n          try {\n            return await mod.getGenerativeModel(originalAI, primaryOptions).generateContent(prompt);\n          } catch (primaryFirebaseError) {\n            const requestedModel = String(primaryOptions?.model || '');\n            if (requestedModel === 'gemini-3.5-flash') throw primaryFirebaseError;\n            const stableOptions = firebaseCompatibleOptions(options, 'gemini-3.5-flash');\n            console.warn('[NOVA Pro] primary Firebase model failed; trying stable Gemini 3.5 Flash fallback.', primaryFirebaseError);\n            return await mod.getGenerativeModel(originalAI, stableOptions).generateContent(prompt);\n          }"
if new not in text:
    if old not in text:
        raise SystemExit('Firebase generate fallback anchor missing')
    text = text.replace(old, new, 1)

path.write_text(text)
