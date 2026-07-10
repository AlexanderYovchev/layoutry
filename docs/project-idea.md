# Project Idea

## Concept

VisCSS is a browser-accessible tool that lets users visually design a web page's HTML/CSS without writing code, then optionally export the generated source.

## Core Interaction Pattern

1. The user opens the tool in their browser.
2. They select one or more HTML elements on the page (e.g. a text block, a container, a button).
3. A CSS control panel appears, exposing the relevant properties for the selected element(s) — spacing, sizing, colors, z-index, typography, and more.
4. The user adjusts values (scales, pixels, colors, indexes, etc.) through the panel.
5. Changes are applied to the live page in real time, immediately after each adjustment.

Conceptually, this mirrors a drawing tool: instead of a canvas with a drawing toolbar, VisCSS presents a live page with an HTML/CSS control toolbar.

## Target User

Anyone who isn't sure what style or layout to give a web page and wants to improvise visually before writing (or committing to) actual code — including non-technical users, designers prototyping quickly, and developers exploring options.

## Monetization

Viewing and live-editing the page is free. Copying/exporting the generated HTML/CSS source code is a subscription feature.

## Development Process

- Project management, brainstorming, and review/optimization are driven through ChatGPT, which also generates implementation prompts for Claude Code.
- Claude Code acts as the primary implementer, writing the actual application source code.
