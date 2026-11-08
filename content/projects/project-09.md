---
title: Chart Accessibility for Workday
tagline: Making Workday's charts readable without relying on color.
summary: Provide fill patterns for the charting tool that improve accessibility
  and work with the current design system. Existing patterns lacked logic, did
  not match system colors, and were hard to read at small sizes. I developed the
  structure to find new patterns.
client: Workday
role: UI Designer
timeline: "2018"
goals: Design a pattern library to support people with color blindness.
outcome: A pattern system built from basic elements, tuned for density in small
  spaces. I met accessibility standards by interpolating colors to meet contrast
  levels.
responsibilities: Visual design, research, exploration, prototyping, and recommendations.
team: A charting developer and the design systems team.
categories:
  - Data Visualization
  - UI Design
  - Design Systems
years: 2018-2019
section: work
start_year: 2018
featured: false
hidden: false
description: Placeholder description of project 09 for search engines and link previews.
cover: /images/logos/workdayColor.svg
cover_alt: Workday logo
drawer_image: /images/projects/fill_pattern_cover_big_2.png
drawer_image_alt: Placeholder image for project 09
prototype_size: half
sections:
  - heading: Understanding the Context
    text: >+
      ##### When I began this project, I researched whether the current patterns
      followed any logic. They did not match the system colors and were hard to
      read at small sizes; the charting library did not offer any guidance. I
      learned it was a neglected part of the design system, and I embraced the
      challenge.

    images:
      - image: /images/projects/Before_FillPattern_WD.png
        sound: false
        alt: "Placeholder: image that sets the context"
        caption: "I began with researching the legacy fill patterns on the Workday
          platform. "
        size: half-text
  - heading: Define Logic to Display the Patterns
    text: "The developer needed guidance on a way to implement patterns. "
    images:
      - image: /images/projects/Before_FillPattern_Dev.png
        sound: false
        alt: Before image of Workday chart Patterns that lacked logic.
        caption: The developer made an attempt to design patterns and I provided
          guidance on a way to implement patterns.
        size: text-half
  - heading: Exploring Spacial Density
    text: >+
      ##### After selecting basic elements, I explored options ranging from
      sparse to dense patterns. After selecting patterns, I began incorporating
      colors from the design system.

    images:
      - image: /images/projects/FillPattern_processMap-2.png
        sound: false
        alt: Matrix for creating pattterns
        caption: Working with basic elements, I created a matrix to find patterns that
          would contribute to the design system library.
        size: half-text
  - heading: Challenges
    text: This was new territory, and I developed a process for designing patterns
      on my own and proposing them to my team. I looked at the foreground and
      background to examine which contrast would be the most legible.
    images:
      - image: /images/projects/FillPattern_logic.png
        sound: false
        alt: "Placeholder: a challenge and how you solved it"
        caption: To sort out the contrast levels, I looked at normal and reverse pattern
          structure.
        size: text-half
  - heading: Close Collaboration with Development
    text: I worked with a codepen that the developer created to help me formulate
      the color patterns.
    images:
      - image: /images/projects/FP_Interpolation (1).png
        sound: false
        alt: "Placeholder: design iteration or alternative"
        caption: Interpolating the colors to find the right level of contrast for the
          patterns.
        size: half-text
  - heading: Outcome
    text: >+
      ##### Based on legibility standards, I used color interpolation to blend
      between the two values. This produced a set of high-contrast color and
      fill pattern pairs. This project created positive business value by
      incorporating accessibility and consistency into Workday's charting
      library. I created logic for how the patterns were displayed and connected
      it to the design system's colors. 

    images:
      - image: /images/projects/ShippedPattern-1.png
        sound: false
        alt: "Placeholder: result or shipped product"
        caption: The shipped pattern library.
        size: full
  - heading: Accessible Patterns Shipped in the Workday Platform
    text: >+
      ##### The new color schemes and fill patterns significantly improved
      accessibility across the platform, making it easier for a wider range of
      individuals to navigate and interact with charts in the Workday
      enterprise. Patterns shipped, complied with usability/contrast standards,
      and were incorporated into the design system. The project was well
      received and improved accessibility across the platform.
---
When I joined the company, Workday Analytics was replacing the current visualization library with one that could handle large volumes of data. Over two months, I audited the current framework, conceptualized a pattern-based approach, executed the designs, and tested the patterns internally. Accessibility is ethically the right thing to do. I was thrilled to have the opportunity to contribute to this feature.