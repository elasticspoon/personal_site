---
layout: post
title: "Deflaking System Specs by migrating from Selenium to Playwright"
summary: An overview of a migration from Selenium back Capybara specs to Playwright.
cover-img: /assets/img/thumbnails/playwright-crappy.png
thumbnail-img: /assets/img/thumbnails/playwright-crappy.png
share-img: /assets/img/thumbnails/playwright-crappy.png
readtime: true
toc: true
unpublished: true
tags:
  - rails
  - ruby
  - testing
  - system specs
  - playwright
  - capybara
---

# Deflaking System Specs by migrating from Selenium to Playwright

The post is mainly targeted towards Ruby developers that write system specs and
have issues with non-determinism. I recently worked on porting several Rails
codebases from Selenium to Playwright backed tests and saw massive increases
in consistency of tests.

{% include picture_tag.html src="playwright_results.jpg" alt="An image showing a graph with a flake rate hovering around 40% then seeing a sharp drop to sub 10%" %}

Currently, the best resource I have found is [this post by Justin Searls](https://justin.searls.co/posts/running-rails-system-tests-with-playwright-instead-of-selenium/).
However, that post mainly covers the happy path of the migration. In this
post I cover some of the issues you may run into with apps using React,
Turbo or Stimulus in more depth.

## How to install it?

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**Skip if**\\
> You already have it set up or you need more depth, [this post by Justin Searls](https://justin.searls.co/posts/running-rails-system-tests-with-playwright-instead-of-selenium/) does a better job.

Add Playwright to your Gemfile

```rb
gem "capybara-playwright-driver"
```

Add playwright installation to you `bin` scripts. This will keep the Playwright installation
via yarn in sync with the version the gem requires.

```rb
# bin/setup
require 'playwright'

playwright_version = Playwright::COMPATIBLE_PLAYWRIGHT_VERSION.strip

# other stuff...

system! "yarn add -D playwright@#{playwright_version}"
system! "yarn run playwright install"
```

Set up the playwright driver

```rb
Capybara.register_driver(:playwright) do |app|
  Capybara::Playwright::Driver.new(
    app,
    headless: true,
  )
end

RSpec.configure do |config|
  config.before(:each, type: :system) do
    driven_by :playwright
  end

end
```

Add the dependencies to your CI (we run everything in Docker thus it was a one liner):

```sh
yarn run playwright install --with-deps chromium-headless
```

## An Aside on Faster Tests

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**Skip if**\\
> You don't write system specs, don't write flaky ones or don't need a refresher.

Playwright tests are faster, thus, some expectations that would
would pass due to system specs running slowly no longer pass.

Lets look at an example. You have a page with cards on it that represent appointments.

{% include picture_tag.html src="./system_spec_1.png" alt="A page for scheduling appointments it has a single card with an appointment in it and a button to create new ones" %}

Pressing new pops open a modal that allows you to schedule a new appointment.

{% include picture_tag.html src="./system_spec_2.png" alt="A page for scheduling appointments it has two cards, one above the other. The card with the time of 10AM is listed before the time 12PM." %}

You want to test that the cards appear in the right order: first appointment of the day to last. (Lets suspend disbelief about
whether or not this requires a system spec.)

So you write the following test:

```rb
header = find('.card__title', match: :first)
expect(header.text).to eq('Blood Draw')

click_on "New"
fill_in_appointment(appointment) # imagine the helper exists
click_on "Submit"

header = find('.card__title', match: :first)
expect(header.text).to eq('Annual Physical Draw')
```

So whats the issue? You are checking the title of the first card each time, looks fine right?

This code can have race conditions. When you run a system specs you are in essence
running 3 different processes: the server serving your app under test, the code doing the testing
and the Javascript on the page.

The Javascript on the page is what can cause you the most trouble. If the expectations that the
test is making get ahead of where the Javascript is at you get failures. They are flaky because
sometimes the Javascript will keep pace and sometime it won't.

Lets first look at the happy path of the code execution:

```rb
# page loads
header = find('.card__title', match: :first)
expect(header.text).to eq('Blood Draw') # this is found

click_on "New"
fill_in_appointment(appointment)
click_on "Submit"

# page loads

header = find('.card__title', match: :first) # element found (10 AM Card)
expect(header.text).to eq('Annual Physical Draw') # passes
```

But consider the situation where the cards are added via Javascript, be that React or maybe
a TurboStream. This order might look different.

```rb
# page loads
header = find('.card__title', match: :first)
expect(header.text).to eq('Blood Draw') # this is found

click_on "New"
fill_in_appointment(appointment)
click_on "Submit"

# page is still loading

header = find('.card__title', match: :first) # element found (12 PM Card)
expect(header.text).to eq('Annual Physical Draw') # fails

# page is done loading
```

This time the Javascript on the page took longer while the test _raced_ ahead,
it found the header **before** the second card got added. This is how find
works, if there is a matching element it will immediately find it. This
element had the wrong text so the test failed.

What can we do? We want to combine the locator `find('.card__title)`
with the assertion `text eq "Some Title"`. This can be done with `have_`
selectors in Capybara:

```rb
expect(page).to have_css('.card__title', text: 'Some Title')
```

This expectation will continuously check the page for an element matching
the CSS and text until it hits a timeout. This means that it won't fail
the first time it doesn't find the element unlike the earlier example.

Now that you have gotten a quick refresh on system specs lets look at the
playwright specific issues you may run into.

## Fixing Your Tests

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**This section is not very thorough**\\
> This section mainly contains the surface level differences for more advanced differences see [this post](https://blog.yuribocharov.dev/posts/2025/04/11/Playwright_tips).

### Date Inputs

All inputs **must** be in ISO-8601 format (`YYYY-MM-DD`)

```diff
-fill_in("Date", with: "03/03/2005")
+fill_in("Date", with: "2005-03-03")

-fill_in("Time", with: "8PM")
+fill_in("Time", with: "20:00")
```

### Playwright will not find text in disabled fields

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

That covers the majority of the surface level differences you may run into. But the question
still exists "Is this worth it for me?"

## Is It Worth It?

It depends. I hate giving that answer but there is not other way about it.

Playwright has done wonders for the stability of our test suite. I helped move several applications over.
Some of the migrations took hours, some took weeks. Some migrations cut the time of the test suite in
half. Others had no impact.

If you have flaky system specs then Playwright is worth a shot but I would not switch to Playwright
just for the fun of it.

That said I would love to start a new project that does not use the Capybara
DSL for Playwright and instead use it directly. That is what some larger companies like Github do (although
they do this in TypeScript not Ruby.)
