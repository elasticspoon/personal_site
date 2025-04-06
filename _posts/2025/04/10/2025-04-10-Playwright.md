---
layout: post
title: "Playwright"
summary: An introduction to how we run CI at my company for 25 Rails apps on Github Actions using Docker Compose.
cover-img: /assets/img/thumbnails/ci-overview.jpg
thumbnail-img: /assets/img/thumbnails/ci-overview.jpg
share-img: /assets/img/thumbnails/ci-overview.jpg
readtime: true
toc: true
unpublished: true
tags:
  - rails
  - ruby
  - continuous-integration
  - github-actions
---

# Playwright - Needs a better title

The post is mainly targeted towards Ruby developers that write system specs and
have issues with non-determinism. I recently worked on porting several Rails
codebases from Selenium to Playwright backed tests and saw massive increases
in consistency of tests.

Add picture here.

Currently, the best resource I have found is [this post by Justin Searls](https://justin.searls.co/posts/running-rails-system-tests-with-playwright-instead-of-selenium/).
However, that post mainly covers the happy path of the migration. In this
post I cover some of the issues you may run into with apps using React,
Turbo or Stimulus in more depth.

## How to install it?

> [!NOTE] Skip if
> You already have it set up or you need more depth, [this post by Justin Searls](https://justin.searls.co/posts/running-rails-system-tests-with-playwright-instead-of-selenium/) does a better job.

Add `gem "capybara-playwright-driver"` to your Gemfile

Add playwright installation to you `bin` scripts.

```rb

```

Set up the playwright driver

Add the dependencies to your CI (we run everything in Docker thus it was a one liner):

```sh
yarn run playwright install --with-deps chromium-headless
```

## An Aside on Faster Tests

> [!NOTE] Skip if
> You don't write system specs, don't write flaky ones or don't need a refresher.

Playwright tests are faster, thus, some expectations that would
would pass due to system specs running slowly no longer pass.

```rb
header = find('.card__title', match: :first)
expect(header.text).to eq('Some Title')
```

If the header is found before the title is updated to
"Some Title" the test will fail. Instead, we want to combine the
locator `find('.card__title)` with the assertion `text eq "Some Title"`.

This can be done with `have_` selectors in Capybara:

```rb
expect(page).to have_css('.card__title', text: 'Some Title')
```

This expectation will continuously check the page for an element matching
the css and text until it hits a timeout. This means that it won't fail
the first time it doesn't find the element unlike the earlier example.

```rb
expect(page.find_link('Some Button')['data-disabled']).to eq 'true'
```

If the link is found before the Javascript adds `data-disabled` the
test will fail.

```rb
expect(page).to have_css("a[data-disabled='true']", text: 'Some Button')
```

Now comes the fun part.

## Fixing Your Tests

> [!NOTE] This section is not very thorough
> This section mainly contains the surface level differences for more advanced differences see this post.

### Date Inputs

All inputs **must** be in ISO-8601 format (`YYYY-MM-DD`)

```diff
-fill_in("Date", with: "03/03/2005")
+fill_in("Date", with: "2005-03-03")

-fill_in("Time", with: "8PM")
+fill_in("Time", with: "20:00")
```

### It does not find text that is present in disabled fields

In selenium specs `have_text` will match text that is present in
fields that are disabled, Playwright will not.

```diff
-expect(page).to have_text('Some comments here')
+expect(page).to have_field("Comments", with: 'Some comments here', disabled: true)
```

### Playwright will not Click on Disabled Elements

Playwright doesn't not allow interaction with disabled elements. If a
button or a link is disabled and you interact with it Playwright will
throw an error.

### `accept_confirm`, `dismiss_confirm`, `accept_alert`, `dismiss_alert` will not work unless passed blocks

```diff
-click 'Some Link'
-accept_confirm
+accept_confirm do
+  click 'Some Link'
+end
```

### Playwright treats XPATH `//` differently

An xpath starting with `//` should match anything across the whole document.
In Playwright it remains scoped to whatever block you are in.

For example:

```rb
within "section" do
  expect(page).to have_xpath("//something")
end
```

This should match parts of the page outside `section` but in Playwright it won't.
Use `page.document` to fix this.

```rb

# bad
within "section" do
  page.find(:xpath, '//span')
end

# fixed
within "section" do
  page.document.find(:xpath, '//span')
end
```

### Native Interaction Syntax

There are some syntax differences if you want to interact more directly with elements:

```diff
# Native Sending Key Presses
-find_field(selector).native.send_keys(:delete)
+find_field(selector).native.press("Delete")

# Accessing Windows
-page.driver.browser.window_handles
+windows

# Switching Windows
-page.driver.browser.switch_to.window(window)
+switch_to_window(window)
```

That covers

## Is It Worth It?
