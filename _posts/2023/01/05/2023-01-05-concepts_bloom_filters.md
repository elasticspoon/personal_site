---
layout: post
title: "Exploring Concepts: Bloom Filters"
readtime: true
toc: true
tags:
  - ruby
  - bloom
  - filter
  - concepts
summary: In this post I explore what a Bloom Filter is, how they are used in the real world and code one from scratch in Ruby.
---

# Exploring Concepts: Bloom Filters

Ever wondered how, when signing up for Gmail, it can immediately tell you whether the account name you are selecting is in use? Is Google running Gmail on something so powerful that it can inspect every Gmail account and tell you if you are trying to make a duplicate? Of course not; instead, it is using a very neat data structure called a **Bloom filter.**

Taking the definition directly from Wikipedia:

> A **Bloom filter** is a space-efficient [probabilistic](https://en.wikipedia.org/wiki/Probabilistic "Probabilistic") [data structure](https://en.wikipedia.org/wiki/Data_structure "Data structure") that is used to test whether an [element](<https://en.wikipedia.org/wiki/Element_(mathematics)> "Element (mathematics)") is a member of a [set](<https://en.wikipedia.org/wiki/Set_(computer_science)> "Set (computer science)"). In other words, a query yields either 'possibly in the set' or 'definitely not in the set'. Elements can be added to the set, but not removed (though this can be addressed with the [counting Bloom filter](https://en.wikipedia.org/wiki/Bloom_filter#Counting_Bloom_filters) variant); the more items added, the larger the probability of false positives.

To summarize, there are three important features:

1. It indicates that an item is **potentially in the set.**
2. It confirms that an item is **definitely not** in the set.
3. Accuracy decreases as more values are added.

## Coding a Bloom Filter

The basic strategy combines two things: a bit array and a hash function.

A bit array is just an array of arbitrary size where each spot is either a 0 or 1. We could emulate that with something like:

```ruby
# nil will represent 0, and not nil will be 1
bit_array = Array.new(10)
```

A hash function is a function that takes an input of arbitrary size and always returns an output of the same size, with the same unique output for each input. For example, "dog" may get hashed to 'a5de…', but no matter who enters "dog," it will always get hashed to the same thing.

For a Bloom filter, you typically want to use the same hashing function but provide it several seeds. We will take a shortcut and use some built-in libraries.

```ruby
# libraries provide several common hashes: sha1, md5, etc
require 'digest'
require 'digest/sha1'
require 'digest/sha2'
require 'digest/md5'
Digest::SHA1.hexdigest 'dog'
# => e495....
Digest::SHA2.hexdigest 'dog'
# => cd63...
Digest::MD5.hexdigest 'dog'
# => 06d8...
```

What do we do with these values? We take the returned value `v`, modulus it by the size of our bit array `v % array_size`. The result will be the index for the bit we change. That is if it returns 3, we change our bit array to `[nil, nil, nil, 1, …]`. It is ugly but we can do something like: `Digest::SHA1.hexdigest('dog').to_i(16) % array_size`. This converts the hex to an integer and takes the modulus equal to the size of the bit array.

We then take the values of all the hash functions, apply them to the array, and "dog" gets stored as:

```ruby
def to_bit_map(message, array_size)
	[(Digest::SHA2.hexdigest message).to_i(16) % array_size,
	(Digest::SHA1.hexdigest message).to_i(16) % array_size,
	(Digest::MD5.hexdigest message).to_i(16) % array_size]
end

bit_array = Array.new(10)
to_bit_map('dog', 10).map { |index| bit_array[index] ||= 1 }
# => [nil, nil, 1, nil, 1, 1, nil, nil, nil, nil]
```

## The Result

We have stored "dog" in our Bloom filter. We can now run `to_bit_map`, and if those same bits aren't flipped, we can say for sure the word isn't stored in the Bloom filter.

We cannot, however, use the Bloom filter to check for the presence of a word. There may be some other word, say "Jeffery," that gives the same result as "dog." So both "dog" and "Jeffery" will appear to be in the Bloom filter. However, if "dog" isn't present, then anything else that hashes the same way is also not. That is why Bloom filters work as they do. They can only confirm that a word is not in them, not that a word is in them.

Keep in mind, you cannot erase any data from a Bloom filter. Changing any of those 1s to 0s could result in countless encoded words getting deleted.
