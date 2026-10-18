using Moq;
using ReservationService.Models;
using ReservationService.Repositories;
using ReservationService.Services;

namespace CinnamonBistro.UnitTests.Reservation;

/// <summary>
/// ReservationCreationService delegates the atomic "check capacity + insert" to the repository (a SQL concern),
/// so these tests verify the delegation contract and that every outcome - including Unavailable (no table
/// free / over capacity) - is surfaced unchanged. Real capacity enforcement is out of unit scope (needs MySQL).
/// </summary>
public class ReservationCreationServiceTests
{
    private readonly Mock<IReservationRepository> _repository = new();
    private readonly ReservationCreationService _sut;

    private static readonly ReservationCreationCommand Command = new(
        CustomerId: 5,
        TableId: 3,
        Period: new AvailabilitySearchCriteria(new DateTime(2026, 10, 19, 18, 0, 0), new DateTime(2026, 10, 19, 19, 30, 0), 4),
        IdempotencyKey: "idem-key-1");

    public ReservationCreationServiceTests()
    {
        _sut = new ReservationCreationService(_repository.Object);
    }

    [Fact]
    public async Task CreateAsync_RepositoryCreatesReservation_ReturnsCreatedResultAndForwardsCommandAndToken()
    {
        using var cts = new CancellationTokenSource();
        var created = new ReservationCreateResult(ReservationCreateOutcome.Created, new ReservationService.Models.Reservation());
        _repository.Setup(r => r.CreateAtomicallyAsync(Command, cts.Token)).ReturnsAsync(created);

        var result = await _sut.CreateAsync(Command, cts.Token);

        Assert.Same(created, result);
        Assert.Equal(ReservationCreateOutcome.Created, result.Outcome);
        _repository.Verify(r => r.CreateAtomicallyAsync(Command, cts.Token), Times.Once);
    }

    [Theory]
    [InlineData(ReservationCreateOutcome.Replayed)]
    [InlineData(ReservationCreateOutcome.TableNotFound)]
    [InlineData(ReservationCreateOutcome.Unavailable)]
    public async Task CreateAsync_RepositoryReportsNonCreatedOutcome_IsPropagatedWithoutRetry(ReservationCreateOutcome outcome)
    {
        _repository
            .Setup(r => r.CreateAtomicallyAsync(It.IsAny<ReservationCreationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReservationCreateResult(outcome));

        var result = await _sut.CreateAsync(Command);

        Assert.Equal(outcome, result.Outcome);
        Assert.Null(result.Reservation);
        _repository.Verify(r => r.CreateAtomicallyAsync(It.IsAny<ReservationCreationCommand>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_RepositoryThrows_ExceptionIsNotSwallowed()
    {
        _repository
            .Setup(r => r.CreateAtomicallyAsync(It.IsAny<ReservationCreationCommand>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TimeoutException("database timeout"));

        var ex = await Assert.ThrowsAsync<TimeoutException>(() => _sut.CreateAsync(Command));

        Assert.Equal("database timeout", ex.Message);
    }
}
