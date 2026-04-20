---
layout: post
title: "On Efficient Long-Sequence Modeling: A Few Observations"
date: 2026-04-20
tags: [research, video understanding, attention]
---

This is a test post to preview the blog layout and styling.

## Motivation

Efficient long-sequence modeling has become one of the central challenges in modern deep learning, particularly for video understanding tasks where input lengths can easily exceed tens of thousands of tokens. Standard full attention scales quadratically with sequence length, making it prohibitively expensive for long videos.

## Three Approaches Worth Thinking About

**Token merging** reduces the effective sequence length by progressively merging redundant tokens. The key insight is that video frames are highly redundant — adjacent frames share most of their content.

**Linear attention** approximates the softmax attention kernel with a linear one, reducing the complexity from $O(n^2)$ to $O(n)$. The trade-off is expressivity, which can sometimes be recovered through careful kernel design.

**Sparse attention** restricts each token to attend only to a local window plus a few global tokens. This is perhaps the most interpretable approach: it encodes a structural prior that nearby tokens are more relevant.

## A Tentative Hierarchy

In practice, the choice between these methods depends heavily on the task:

- For **retrieval-heavy tasks** (e.g., finding a specific event in a long video), global context is crucial — sparse local attention alone tends to fail.
- For **dense captioning**, token merging works surprisingly well since most tokens can be compressed without losing salient information.
- For **streaming inference**, linear RNN-based methods have a clear edge due to their constant memory footprint.

## Code Snippet

```python
# Simplified token merging step
def merge_tokens(x, r):
    # x: [B, T, D], r: reduction ratio
    src, dst = x[:, ::2], x[:, 1::2]
    scores = (src * dst).sum(-1)          # cosine-like similarity
    idx = scores.topk(r, dim=1).indices
    dst = dst.scatter_reduce(1, idx.unsqueeze(-1).expand(-1,-1,x.size(-1)),
                             src.gather(1, idx.unsqueeze(-1).expand_as(src[:,:r])),
                             reduce='mean')
    return dst
```

More posts to come as the research progresses.
