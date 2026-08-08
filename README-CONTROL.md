# Codex ChatGPT Web Control

A standalone shared-browser runtime combining:

- ChatGPT Web models in the native Codex task lifecycle; and
- visible ChatGPT Chat/Work workflows with threads, files, steering, response
  capture, and artifacts.

The central safety rule is **one browser process and login, but never one
working page**. Every active operation receives an exclusive host-owned page
lease. Model turns continue to use fresh Temporary Chats; visible Chat and Work
identity is stored independently of renderer lifetime.

This project intentionally has no dependency on `Aerox912/agent-system`.
Orchestration policy and agent-system integration are deferred until that
system is redesigned.
