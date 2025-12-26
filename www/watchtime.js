document.addEventListener('DOMContentLoaded', () => {
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!loggedInUser) return;

    const watchTimeData = db.getWatchTimeLastWeek(loggedInUser.id);
    const labels = [];
    const data = [];
    let totalMinutes = 0;

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));

        const entry = watchTimeData.find(e => e.date === dateString);
        const minutes = entry ? Math.round(entry.seconds / 60) : 0;
        data.push(minutes);
        totalMinutes += minutes;
    }

    const ctx = document.getElementById('watchTimeChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Minutes Watched',
                data: data,
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    document.getElementById('summary').textContent = `Total watch time in last 7 days: ${totalMinutes} minutes.`;
});