---
layout: post
title: "Playwright Tips and Tricks"
summary: A list of learnings from migrating several legacy apps from Selenium backed Capybara to Playwright
cover-img: /assets/img/thumbnails/playwright.png
thumbnail-img: /assets/img/thumbnails/playwright.png
share-img: /assets/img/thumbnails/playwright.png
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

I recently made a post talking about Playwright and the benefits my company
saw from the migration. That post was mainly higher level and it avoided
direct discussion of a lot of the issues I ran into.

This post is meant to be a loose list of the various issues I ran into and
how I managed to solve them.

## `puts` messages

Playwright will output warnings to the console about "execution context destroyed", etc.
These are not always useful. As of [this PR](https://github.com/YusukeIwaki/capybara-playwright-driver/pull/97) we can provide a custom logger to Playwright.

```rb
Capybara.register_driver :Playwright do |app|
  Capybara::Playwright::Driver.new(app,
    # whatever options
    logger: Logger.new(IO::NULL)
  )
end
```

Or if you want to log to a specific file the logger could be a file name.
`Logger.new('log/playwright.log)`. [See the docs for more about the `Logger`.](https://docs.ruby-lang.org/en/3.4/Logger.html)

## Date Inputs

With the `capybara-playwright-driver` all inputs **must** be in ISO-8601
format (`YYYY-MM-DD`). I am not sure if this a Playwright limitation
or the driver.

```diff
-fill_in("Date", with: "03/03/2005")
+fill_in("Date", with: "2005-03-03")

-fill_in("Time", with: "8PM")
+fill_in("Time", with: "20:00")
```

That said we ended up using a patch to make this easier to fix.

```rb
module Capybara
  module PlaywrightDatePatch
    class << self
      def patch! = @patch = true
      def real! = @patch = false
      def patch? = @patch
    end
  end
end

Capybara::Node::Actions.prepend(Module.new do
  def fill_in(locator=nil, with:, currently_with: nil, fill_options: {}, **find_options)
    return super unless Capybara::PlaywrightDatePatch.patch?

    case with
    in /\d{8}\s+\d{4}[p|a]m/
      with = Time.strptime(with, "%m%d%Y\t%I%M%P").strftime("%Y-%m-%dT%H:%M")
    in /\d\d-\d\d-\d\d\d\d/
      with = Time.strptime(with, "%m-%d-%Y").strftime("%Y-%m-%d")
    in %r{\d\d/\d\d/\d\d\d\d}
      with = Time.strptime(with, "%m/%d/%Y").strftime("%Y-%m-%d")
    in %r{\d/\d\d/\d\d\d\d}
      with = Time.strptime(with, "%m/%d/%Y").strftime("%Y-%m-%d")
    in /\d\d\d\d[P|A]M/
      with = Time.strptime(with, "%I%M%P").strftime("%H:%M")
    in /\d\d:\d\d[P|A]M/
      with = Time.strptime(with, "%I:%M%P").strftime("%H:%M")
    in /\d\d:\d\d [P|A]M/
      with = Time.strptime(with, "%I:%M %P").strftime("%H:%M")
    else
      return super
    end
    super
  end
end)

RSpec.configure do |config|
  config.before(:each, type: :system) do |ex|
    if ex.metadata[:patch_dates] == true
      Capybara::PlaywrightDatePatch.patch!
    else
      Capybara::PlaywrightDatePatch.real!
    end
  end
end
```

This overrides the `fill_in` with some regex checks to transform date inputs
beforehand. We used [RSpec Stamp](https://test-prof.evilmartians.io/recipes/rspec_stamp) to take care
of setting the tags.

## `accept_confirm`, `dismiss_confirm`, `accept_alert`, `dismiss_alert` will not work unless passed blocks

```rb
# bad
click 'Some Link'
accept_confirm

# good
accept_confirm do
  click 'Some Link'
end
```

We added some Rubocop linting rules to enforce this but the failures are quite descriptive so is likely overkill.

## Playwright treats XPATH `//` differently

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

## Playwright does not find text that is present in disabled fields

In Selenium specs `have_text` will match text that is present in
fields that are disabled. Playwright does not do this.

```rb
# bad
expect(page).to have_text('Some comments here')
# good
expect(page).to have_field("Comments", with: 'Some comments here', disabled: true)
```

## Playwright will not Click on Disabled Elements

Playwright doesn't not allow interaction with disabled elements. If a
button or a link is disabled and you interact with it Playwright will
throw an error.

## Native Interaction Syntax

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

## Waiting on a page event

Playwright allows you to assert on certain events occurring on the page.

```rb
page.driver.with_playwright_page do |page|
  page.expect_event('load') do
    click_on 'Confirm'
  end
end
```

## Waiting on a window context event

```rb
page.driver.with_playwright_page do |page|
  page.context.expect_event('page') do
    click_on 'Confirm'
  end
end
```

Note: You can only use [certain events](https://github.com/YusukeIwaki/playwright-ruby-client/blob/main/lib/playwright/events.rb)

## Getting a native page

Sometimes you want a one-liner to get the playwright native page outside a block.

```rb
def native_page
  page.driver
    .instance_variable_get(:@browser)
    .instance_variable_get(:@playwright_page)
end
```

NOTE: the client uses a block to ensure the page remains alive, when using outside that
block context you give up that guarantee.

## Javascripting

The syntax to run Javascript also differs.

```rb
Capybara.current_session.driver.with_playwright_page do |page|
  page.evaluate("document.addEventListener('turbo:submit-end', event => { console.log(event) }, true)")
end

find_by_id("some-element").native.evaluate("(element) => element.innerText") # => some text
```

See [element handles](https://playwright-ruby-client.vercel.app/docs/api/js_handle#evaluate) and [page handles](https://playwright-ruby-client.vercel.app/docs/api/page#evaluate).

## Unexpectedly Slow Tests

When attempting to check checkboxes when the input element was
absolutely positioned off of the screen Playwright would bounce around on
the page for upwards of 5 seconds to find the element, this caused our test suite
to go from 10 mins to 50+ min.

```rb
check('some_id', allow_label_click: { x: 123, y: 456 })
```

For some reason this incantation worked better:

```rb
find(:label for: 'some_id').click(x: 123, y: 456)
```

The test suite went from 50+ mins back down to 12.

## Reproducing Errors

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**Chrome Only**

Playwright will often consistently fail on a particular spec in CI but not locally.
This is often a latency issue, HTML / Javascript loads slow in CI while the test
proceeds at the same rate leading to race conditions.

I put together a useful script to reproduce many of those errors locally by using
DevTools to throttle the Chrome connection.

```rb
# spec/support/init/playwright.rb

throttle_rates = {
   'SLOW_3G' => {
    downloadThroughput: ((500 * 1000) / 8) * 0.8,
    uploadThroughput: ((500 * 1000) / 8) * 0.8,
    latency: 400 * 5,
    offline: false
  },
  'FAST_3G' => {
    downloadThroughput: ((1.6 * 1000 * 1000) / 8) * 0.9,
    uploadThroughput: ((750 * 1000) / 8) * 0.9,
    latency: 150 * 3.75,
    offline: false
  },
  "4G" => {
    downloadThroughput: ((4 * 1000 * 1000) / 8) * 0.9,
    uploadThroughput: ((3 * 1000 * 1000) / 8) * 0.9,
    latency: 60 * 2.75,
    offline: false
  }
}

RSpec.configure do |config|
  config.before(:each, type: :system) do |ex|
    if ENV['THROTTLE_CHROME'].present? && [:playwright, :playwright_headful].include?(Capybara.current_driver)
      page.driver.with_playwright_page do |page|
        client = page.context.new_cdp_session(page)
        client.send_message("Network.emulateNetworkConditions",
          params: throttle_rates[ENV['THROTTLE_CHROME']])
      end
    end
  end
end
```

This can be used like `THROTTLE_CHROME=SLOW_3G bundle exec rspec`.

## Playwright Errors (cannot read proprieties of null, etc)

Sometimes the Capybara DSL just fails us. For example there is some Javascript on the
page that is altering an element while we run `fill_in :filter, with: "value"`.
The test keeps failing inconsistently.

This is the time to bring out the big guns: [playwright auto-waiting locators](https://playwright-ruby-client.vercel.app/docs/api/locator). These leverage
the auto-waiting feature built-in to playwright (instead of the once in Capybara) to wait for
elements to stabilize before interacting with them. You can read more about the auto-waiting [here](https://playwright.dev/docs/actionability).

So that `fill_in` might instead be:

```rb
page.driver.with_playwright_page do |page|
  page.locator('#some_id').fill_in("value")
end
```

## Using Web First Assertions

Like the locators above Playwright provides web first Capybara style assertions for use.

See [the docs for a full list](https://playwright-ruby-client.vercel.app/docs/api/locator_assertions). These are very consistent and solve a lot of flakiness but they collide
with existing Capybara expectations so you cannot use both in the same test.

Fear not for this too I have a sloppily thrown together helper:

```rb
# spec/support/init/capybara_helpers.rb
module CapybaraHelpers
  def native_page
    page.driver.instance_variable_get(:@browser).instance_variable_get(:@playwright_page)
  end

  def playwright_locator(selector_or_locator='body', **kwargs)
    native_page.locator(selector_or_locator, **kwargs)
  end
end

RSpec.configure do |config|
  config.include CapybaraHelpers
end

# spec/support/init/playwright.rb
require 'playwright/test'

Playwright::Test.prepend(Module.new do
  Playwright::Test::ALL_ASSERTIONS
    .map(&:to_s)
    .each do |method_name|
      root_method_name = method_name.gsub('to_', '')
      Playwright::Test::Matchers.send(:define_method, root_method_name) do |*args, **kwargs|
        use_playwright = kwargs[:playwright] != true
        kwargs.delete(:playwright_native)

        return super(*args, **kwargs) if use_playwright

        Playwright::Test::Matchers::PlaywrightMatcher.new(method_name, *args, **kwargs)
      end
    end
end)

RSpec.configure do |config|
  config.include Playwright::Test::Matchers, type: :system
end
```

With these helpers you can run assertions like:

```rb
expect(playwright_locator).to have_text("some text", playwright: true)
expect(playwright_locator("#some_id")).to be_enabled("some text", playwright: true)
```

Note: there is probably a better way to do this I am simply overriding the method declarations
[where they are made](https://github.com/YusukeIwaki/playwright-ruby-client/blob/56edaff43e3a1099d78d507a6fef2388ab66545b/lib/playwright/test.rb#L73).

## Open Issues

There are still some issues I have not managed to figure (email me if you have a solution, I would love to hear it).

### Issues with Turbo Steams

These seem to give the Capybara driver issues. For example if I am searching for test on the page with `expect(page).to have_text('Card Title')` and
that card is added to the page via a Turbo Stream if will sometimes not find it. The failure is flaky enough that a reproduction has eluded me.

### Type Errors

We get errors like this

```console
Playwright::Error:
  TypeError: Cannot read properties of null (reading 'namespaceURI')
    at eval (eval at evaluate (:234:40), <anonymous>:17:12)
    at UtilityScript.evaluate (<anonymous>:241:19)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
  Call log:
```

What do they mean? I have no clue, I have not been able to hunt them down but using Playwright native locators and tests seems to alleviate the issue.
