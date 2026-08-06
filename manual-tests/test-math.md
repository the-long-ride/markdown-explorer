# 🧪 Test: Mathematical Notation

This document tests the display of mathematical notation and LaTeX-style formulas.

---

## 1. Regression Formulas

Mean Squared Error (MSE):
$$
\mathrm{MSE}
= \frac{1}{n}\sum_{i=1}^{n}(y_i - \hat{y}_i)^2
$$

Root Mean Squared Error (RMSE):
$$
\mathrm{RMSE}
= \sqrt{\frac{1}{n}\sum_{i=1}^{n}(y_i - \hat{y}_i)^2}
$$

---

## 2. Statistical PDF

Gaussian Probability Density Function (PDF):
$$
f(x)
= \frac{1}{\sigma\sqrt{2\pi}}
\exp\left(
  -\frac{(x-\mu)^2}{2\sigma^2}
\right)
$$

---

## 3. Inline Equations

- Quadratic formula solution: $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$
- Standard normal variable: $Z = \frac{X-\mu}{\sigma}$
- Limit definition: $f'(x) = \lim_{h \to 0}\frac{f(x+h)-f(x)}{h}$

Inline LaTeX-style notation:

- Bayes rule: $P(A \mid B) = \frac{P(B \mid A)P(A)}{P(B)}$
- Euler identity: $e^{i\pi} + 1 = 0$
- Vector norm: $\lVert \mathbf{x} \rVert_2 = \sqrt{\sum_{i=1}^{n} x_i^2}$
- Big-O bound: $T(n) \in O(n \log n)$
- Inline parenthesis delimiter: \( \nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0} \)

---

## 4. Display Math Blocks

Softmax with temperature:

$$
\operatorname{softmax}_i(\mathbf{z}, \tau)
= \frac{\exp(z_i / \tau)}
{\sum_{j=1}^{K} \exp(z_j / \tau)}
$$

Cross entropy loss:

$$
\mathcal{L}(\theta)
= -\frac{1}{N}\sum_{i=1}^{N}
\sum_{c=1}^{C} y_{ic}\log \hat{y}_{ic}
$$

Fourier transform pair:

$$
\mathcal{F}\{f(t)\}(\omega)
= \int_{-\infty}^{\infty} f(t)e^{-i\omega t}\,dt,
\qquad
f(t) = \frac{1}{2\pi}\int_{-\infty}^{\infty}
\hat{f}(\omega)e^{i\omega t}\,d\omega
$$

Bracket display math delimiter:

\[
\int_{\partial \Omega} \omega
=
\int_{\Omega} d\omega
\]

---

## 5. Matrices And Linear Algebra

Matrix inverse and determinant:

$$
A^{-1} = \frac{1}{\det(A)}\operatorname{adj}(A)
$$

$$
\det
\begin{pmatrix}
a & b & c \\
d & e & f \\
g & h & i
\end{pmatrix}
= a(ei - fh) - b(di - fg) + c(dh - eg)
$$

Eigenvalue decomposition:

$$
A\mathbf{v}_k = \lambda_k \mathbf{v}_k,
\qquad
A = Q\Lambda Q^{-1}
$$

Singular value decomposition:

$$
X = U\Sigma V^\top,
\qquad
\Sigma =
\begin{bmatrix}
\sigma_1 & 0 & \cdots & 0 \\
0 & \sigma_2 & \cdots & 0 \\
\vdots & \vdots & \ddots & \vdots \\
0 & 0 & \cdots & \sigma_r
\end{bmatrix}
$$

---

## 6. Calculus And Differential Equations

Taylor expansion with remainder:

$$
f(x) =
\sum_{k=0}^{n}
\frac{f^{(k)}(a)}{k!}(x-a)^k
+
\frac{f^{(n+1)}(\xi)}{(n+1)!}(x-a)^{n+1}
$$

Euler-Lagrange equation:

$$
\frac{\partial \mathcal{L}}{\partial q}
-
\frac{d}{dt}
\left(
  \frac{\partial \mathcal{L}}{\partial \dot{q}}
\right)
= 0
$$

Heat equation:

$$
\frac{\partial u}{\partial t}
= \alpha \nabla^2 u,
\qquad
u(x,0) = f(x)
$$

Navier-Stokes momentum equation:

$$
\rho\left(
  \frac{\partial \mathbf{u}}{\partial t}
  + (\mathbf{u}\cdot\nabla)\mathbf{u}
\right)
= -\nabla p + \mu\nabla^2\mathbf{u} + \mathbf{f}
$$

---

## 7. Probability And Information Theory

KL divergence:

$$
D_{\mathrm{KL}}(P \Vert Q)
= \sum_{x \in \mathcal{X}} P(x)\log\frac{P(x)}{Q(x)}
$$

Expected value with nested conditioning:

$$
\mathbb{E}[X]
= \mathbb{E}\!\left[\mathbb{E}[X \mid Y]\right]
$$

Multivariate Gaussian:

$$
p(\mathbf{x})
= \frac{1}{(2\pi)^{k/2}|\Sigma|^{1/2}}
\exp\left(
  -\frac{1}{2}
  (\mathbf{x}-\boldsymbol{\mu})^\top
  \Sigma^{-1}
  (\mathbf{x}-\boldsymbol{\mu})
\right)
$$

---

## 8. Optimization

Constrained optimization with KKT conditions:

$$
\begin{aligned}
\min_{\mathbf{x}} \quad & f(\mathbf{x}) \\
\text{s.t.} \quad & g_i(\mathbf{x}) \le 0,\quad i=1,\ldots,m \\
& h_j(\mathbf{x}) = 0,\quad j=1,\ldots,p
\end{aligned}
$$

$$
\begin{aligned}
\nabla f(\mathbf{x}^\star)
+ \sum_{i=1}^{m}\lambda_i^\star\nabla g_i(\mathbf{x}^\star)
+ \sum_{j=1}^{p}\nu_j^\star\nabla h_j(\mathbf{x}^\star)
&= 0 \\
\lambda_i^\star g_i(\mathbf{x}^\star) &= 0 \\
\lambda_i^\star &\ge 0
\end{aligned}
$$

Adam update:

$$
\begin{aligned}
m_t = \beta_1 m_{t-1} + (1-\beta_1)g_t
\\
v_t = \beta_2 v_{t-1} + (1-\beta_2)g_t^2
\\
\hat{m}_t = \frac{m_t}{1-\beta_1^t}
\\
\hat{v}_t = \frac{v_t}{1-\beta_2^t}
\\
\theta_t = \theta_{t-1} - \eta\frac{\hat{m}_t}{\sqrt{\hat{v}_t}+\epsilon}
\end{aligned}
$$

---

## 9. Tensors And Deep Learning

Scaled dot-product attention:

$$
\operatorname{Attention}(Q,K,V)
= \operatorname{softmax}
\left(
  \frac{QK^\top}{\sqrt{d_k}}
\right)V
$$

Einstein summation:

$$
C_{ij}
= \sum_{k=1}^{n} A_{ik}B_{kj},
\qquad
T^{\alpha\beta}_{\ \ \gamma}
= g^{\alpha\mu}g^{\beta\nu}T_{\mu\nu\gamma}
$$

Backpropagation through layer stack:

$$
\frac{\partial \mathcal{L}}{\partial W^{(\ell)}}
=
\left(
  \frac{\partial \mathcal{L}}{\partial a^{(L)}}
  \prod_{k=\ell+1}^{L}
  \frac{\partial a^{(k)}}{\partial a^{(k-1)}}
\right)
\frac{\partial a^{(\ell)}}{\partial W^{(\ell)}}
$$
