---
layout: post
title: "Exploring Concepts: Bloom Filters"
readtime: true
toc: true
tags: [ruby, bloom filter]
---

# Exploring Concepts: Bloom Filters

Ever wondered how when you sign up for Gmail it can immediately tell you whether the account name you are selecting is in use? Is Google running Gmail on something so powerful that it can look at every single Gmail account and tell you if you are trying to make a duplicate? Of course not, instead it is using a very neat data structure called a **bloom filter.**

Taking the definition directly of Wikipedia:

> A **Bloom filter** is a space-efficient [probabilistic](https://en.wikipedia.org/wiki/Probabilistic "Probabilistic") [data structure](https://en.wikipedia.org/wiki/Data_structure "Data structure") that is used to test whether an [element](<https://en.wikipedia.org/wiki/Element_(mathematics)> "Element (mathematics)") is a member of a [set](<https://en.wikipedia.org/wiki/Set_(computer_science)> "Set (computer science)"). [False positive](https://en.wikipedia.org/wiki/Type_I_and_type_II_errors "Type I and type II errors") matches are possible, but [false negatives](https://en.wikipedia.org/wiki/Type_I_and_type_II_errors "Type I and type II errors") are not – in other words, a query returns either "possibly in set" or "definitely not in set". Elements can be added to the set, but not removed (though this can be addressed with the [counting Bloom filter](https://en.wikipedia.org/wiki/Bloom_filter#Counting_Bloom_filters) variant); the more items added, the larger the probability of false positives.

To summarize there are three important features:

1. It tells you that an item is **possibly in** set
2. It tells you that an item is **definitely not** in set
3. It gets less accurate the more values you add to it

What better way to understand a bloom filter than to hack together our own.

## Coding a Bloom Filter

The basic strategy combines 2 things: a bit array and a hash function.

A bit array is just an array of arbitrary size where each spot is either a 0 or 1. We could do emulate that with something like:

```ruby
# nil will represent 0 and not nil will be 1
bit_array = Array.new(10)
```

A hash function is a function that takes an input of arbitrary size and always returns an output of the same size, with the same unique output for each input. Ex: "dog" may get hashed to 'a5de…' but no matter who enters dog, it will always get hashed to the same thing.

For a bloom filter you typically want to use the same hashing function but provide it several seeds. We will take a shortcut and use some built-in libraries.

```ruby
# libaries provides several common hashes: sha1, md5, etc
require 'digest'
require 'digest/sha1'
require 'digest/sha2'
require 'digest/md5'
DIGEST::SHA1.hexdigest 'dog'
# => e495....
DIGEST::SHA2.hexdigest 'dog'
# => cd63...
DIGEST::MD5.hexdigest 'dog'
# => 06d8...
```

What do we do with these values? We take the returned value `v`, modulus it by the size of our bit array `v % array_size`. The result will be the index for the bit we change. That is if it returns 3 we change our bit array to `[nil, nil, nil, 1, …]`. It is ugly but we can do something like: `DIGEST::SHA1.hexdigest('dog').to_i(16) % array_size`. This converts the hex to an integer and takes the modulus equal to size of bit array.

We then take the values of all the hash functions, apply them to array and dog gets stored as:

```ruby
def to_bit_map(message, array_size)
	[(Digest::SHA2.hexdigest message).to_i(16)% array_size,
	(Digest::SHA1.hexdigest message).to_i(16)% array_size,
	(Digest::MD5.hexdigest message).to_i(16)% array_size]
end

bit_array = Array.new(10)
to_bit_map('dog', 10).map {|index| bit_array[index] ||= 1}
bit_array
#=> [nil, nil, 1, nil, 1, 1, nil, nil, nil, nil]
```

## The Result

We have stored "dog" in our bloom filter. We can run now run `to_bit_map`, and if those same bits aren't flipped we can say for sure the word isn't store int the bloom filter.

We cannot, however, use the bloom filter to check for the presence of a word. There may be some other word, say "jeffery" that gives the same result as "dog". So both "dog" and "jeffery" will appear to be in the bloom filter. However, "dog" isn't present then any else that hashes the same way is also not. That is why bloom filters work as they do. They can only say for sure that a word is not in them, not that a word is in them.

Keep in mind. You cannot erase any data from a bloom filter. Change any of those ones to a zero and there could be countless encoded words getting deleted.
