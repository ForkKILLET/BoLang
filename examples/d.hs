{-# LANGUAGE NumericUnderscores #-}

inf = 1 / 0
v f x1 x2 = ((f x2) - (f x1)) / (x2 - x1)
vh f x h = v f x (x + h)
d e f x = d1 e f x 1 inf
  where
    d1 e f x h v0 =
      let v = vh f x h
      in
        if abs (v - v0) < e then v
        else d1 e f x (h * 0.5) v