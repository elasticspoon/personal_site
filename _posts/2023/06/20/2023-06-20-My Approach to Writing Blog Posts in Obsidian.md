---
layout: post
title: My Approach to Writing Blog Posts in Obsidian
subtitle: Some Sample Subtitle
readtime: true
tags: [sample, tag]
---

{:toc}

## My Approach to Writing Blog Posts in Obsidian

I currently use a fair simple system to leverage Obsidian to make writing blog posts and formatting them as needed super easy.

### Using Markdown

First of all, I write all my blog posts in basic markdown files. This means that they will work with basically an static site generator as posts for a blog. I personally use Jekyll but what exactly you use does not matter.

### Note Refactor

Typically I will write most of my notes in my daily note and then refactor the content out with [Note Refactor.](https://obsidian.md/plugins?id=note-refactor-obsidian) The plug-in allows me to select the content of a blog post in my Daily Note and then move that content to a new file in a give directory with that content.

#### File Location Settings

{% include picture_tag.html src='location-settings.jpg' alt='Settings for Refactor plugin file location' %}

These are settings I use for the location to create the refactored note. The main idea is that I make the directory of the file mirror the directory I would use in my SSG. A file I refactor out today will land in `Blog/current_year/current_month/current_day/YYYY-MM-DD-topmost-header.md`. Which is exactly what I want for my blog because it also allows me to collocate all pictures associated with that post in the same directory.

{% include picture_tag.html src='blog-directory.jpg' alt='Contents of my Blog directory' %}

#### Template Settings

The second piece of the puzzle is adding in the needed frontmatter to the post. The refactoring plug-in has a simple setting to allow a template. I use a generic blog post template with frontmatter for my SSG that I remove as needed.

{% include picture_tag.html src='note-template.jpg' alt='Template for my note.' %}

#### Fixing Headers

That last thing you may notice is that after you refactor the note out is that the headings will not be correct. It might extract your blog post as

```md
## Blog Title

### Some Heading

Some text
```

And now everything looks bad and you need to manually correct it. I use another plugin to automatically fix it: [Linter.](obsidian://show-plugin?id=obsidian-linter)The plug-in will automatically fix heading issues like that.

### Getting the Content to My Site Repo

The second part of this whole process is actually getting the content from
