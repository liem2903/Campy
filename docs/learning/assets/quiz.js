// Quiz component. Markup:
// <div class="quiz-q" data-answer="2" data-why="Explanation shown after answering.">
//   <p>Question?</p>
//   <div class="quiz-opts"><button>A</button><button>B</button><button>C</button></div>
// </div>
// data-answer is the 0-based index of the right option. Wrong picks can be retried.
for (const q of document.querySelectorAll('.quiz-q')) {
  const answer = Number(q.dataset.answer)
  const why = document.createElement('p')
  why.className = 'quiz-why'
  q.append(why)
  q.querySelectorAll('.quiz-opts button').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (i === answer) {
        btn.classList.add('right')
        why.innerHTML = '<span class="ok">Right.</span> ' + q.dataset.why
      } else {
        btn.classList.add('wrong')
        why.innerHTML = '<span class="bad">Not quite.</span> Try again.'
      }
    })
  })
}
