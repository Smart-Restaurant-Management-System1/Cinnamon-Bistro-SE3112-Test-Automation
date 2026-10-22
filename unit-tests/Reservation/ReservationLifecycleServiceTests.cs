using Moq;
using ReservationService.Models;
using ReservationService.Repositories;
using ReservationService.Services;

namespace CinnamonBistro.UnitTests.Reservation;

/// <summary>
/// Unit tests for <see cref="ReservationLifecycleService"/>.
/// Validates status transitions, unknown status rejections, not-found handling,
/// customer cancellation flows, concurrency conflict detection, and Moq method verifications.
/// </summary>
public class ReservationLifecycleServiceTests
{
    private readonly Mock<IReservationRepository> _repository = new();
    private readonly ReservationLifecycleService _sut;

    public ReservationLifecycleServiceTests()
    {
        _sut = new ReservationLifecycleService(_repository.Object);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ChangeStatusAsync — Valid Status Transitions & Successful Update
    // ─────────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(ReservationStatus.Pending, ReservationStatus.Confirmed)]
    [InlineData(ReservationStatus.Pending, ReservationStatus.Cancelled)]
    [InlineData(ReservationStatus.Confirmed, ReservationStatus.Cancelled)]
    [InlineData(ReservationStatus.Confirmed, ReservationStatus.Completed)]
    public async Task ChangeStatusAsync_ValidTransitionAndSuccessfulUpdate_ReturnsUpdated(string currentStatus, string targetStatus)
    {
        const int reservationId = 101;
        const int customerId = 12;

        _repository.Setup(r => r.GetStatusAsync(reservationId, customerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(currentStatus);
        _repository.Setup(r => r.UpdateStatusAsync(reservationId, customerId, currentStatus, targetStatus, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var outcome = await _sut.ChangeStatusAsync(reservationId, customerId, targetStatus);

        Assert.Equal(ReservationStatusUpdateOutcome.Updated, outcome);
        _repository.Verify(r => r.GetStatusAsync(reservationId, customerId, It.IsAny<CancellationToken>()), Times.Once);
        _repository.Verify(r => r.UpdateStatusAsync(reservationId, customerId, currentStatus, targetStatus, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ChangeStatusAsync_AdminCallWithNullCustomerId_ForwardsNullCustomerIdToRepository()
    {
        const int reservationId = 205;

        _repository.Setup(r => r.GetStatusAsync(reservationId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ReservationStatus.Pending);
        _repository.Setup(r => r.UpdateStatusAsync(reservationId, null, ReservationStatus.Pending, ReservationStatus.Confirmed, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var outcome = await _sut.ChangeStatusAsync(reservationId, null, ReservationStatus.Confirmed);

        Assert.Equal(ReservationStatusUpdateOutcome.Updated, outcome);
        _repository.Verify(r => r.GetStatusAsync(reservationId, null, It.IsAny<CancellationToken>()), Times.Once);
        _repository.Verify(r => r.UpdateStatusAsync(reservationId, null, ReservationStatus.Pending, ReservationStatus.Confirmed, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ChangeStatusAsync_CustomerCallWithCustomerId_ForwardsCustomerIdToRepository()
    {
        const int reservationId = 305;
        const int customerId = 77;

        _repository.Setup(r => r.GetStatusAsync(reservationId, customerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ReservationStatus.Confirmed);
        _repository.Setup(r => r.UpdateStatusAsync(reservationId, customerId, ReservationStatus.Confirmed, ReservationStatus.Cancelled, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var outcome = await _sut.ChangeStatusAsync(reservationId, customerId, ReservationStatus.Cancelled);

        Assert.Equal(ReservationStatusUpdateOutcome.Updated, outcome);
        _repository.Verify(r => r.GetStatusAsync(reservationId, customerId, It.IsAny<CancellationToken>()), Times.Once);
        _repository.Verify(r => r.UpdateStatusAsync(reservationId, customerId, ReservationStatus.Confirmed, ReservationStatus.Cancelled, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ChangeStatusAsync — Unknown / Invalid Status Rejection
    // ─────────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Unknown")]
    [InlineData("Approved")]
    [InlineData("PendingApproval")]
    [InlineData("Rejected")]
    [InlineData("CANCELLED")] // Case-sensitive check
    public async Task ChangeStatusAsync_UnknownOrInvalidTargetStatus_ReturnsConflictWithoutQueryingRepository(string? invalidStatus)
    {
        var outcome = await _sut.ChangeStatusAsync(101, 12, invalidStatus!);

        Assert.Equal(ReservationStatusUpdateOutcome.Conflict, outcome);
        _repository.Verify(r => r.GetStatusAsync(It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()), Times.Never);
        _repository.Verify(r => r.UpdateStatusAsync(It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ChangeStatusAsync — Missing Reservation (NotFound)
    // ─────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ChangeStatusAsync_ReservationNotFoundInRepository_ReturnsNotFound()
    {
        const int reservationId = 404;
        const int customerId = 15;

        _repository.Setup(r => r.GetStatusAsync(reservationId, customerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((string?)null);

        var outcome = await _sut.ChangeStatusAsync(reservationId, customerId, ReservationStatus.Confirmed);

        Assert.Equal(ReservationStatusUpdateOutcome.NotFound, outcome);
        _repository.Verify(r => r.GetStatusAsync(reservationId, customerId, It.IsAny<CancellationToken>()), Times.Once);
        _repository.Verify(r => r.UpdateStatusAsync(It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ChangeStatusAsync — Disallowed Status Transitions
    // ─────────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(ReservationStatus.Pending, ReservationStatus.Completed)]   // cannot skip confirmation
    [InlineData(ReservationStatus.Confirmed, ReservationStatus.Pending)]   // cannot revert backwards
    [InlineData(ReservationStatus.Cancelled, ReservationStatus.Confirmed)] // terminal state
    [InlineData(ReservationStatus.Cancelled, ReservationStatus.Pending)]   // terminal state
    [InlineData(ReservationStatus.Completed, ReservationStatus.Cancelled)] // terminal state
    [InlineData(ReservationStatus.Completed, ReservationStatus.Confirmed)] // terminal state
    [InlineData(ReservationStatus.Pending, ReservationStatus.Pending)]     // self transition
    [InlineData(ReservationStatus.Confirmed, ReservationStatus.Confirmed)] // self transition
    public async Task ChangeStatusAsync_DisallowedStatusTransition_ReturnsConflictWithoutCallingUpdate(string currentStatus, string targetStatus)
    {
        const int reservationId = 505;
        const int customerId = 10;

        _repository.Setup(r => r.GetStatusAsync(reservationId, customerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(currentStatus);

        var outcome = await _sut.ChangeStatusAsync(reservationId, customerId, targetStatus);

        Assert.Equal(ReservationStatusUpdateOutcome.Conflict, outcome);
        _repository.Verify(r => r.GetStatusAsync(reservationId, customerId, It.IsAny<CancellationToken>()), Times.Once);
        _repository.Verify(r => r.UpdateStatusAsync(It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ChangeStatusAsync — Repository Update Failure (Conflict)
    // ─────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ChangeStatusAsync_RepositoryUpdateFails_ReturnsConflict()
    {
        const int reservationId = 601;
        const int customerId = 22;

        _repository.Setup(r => r.GetStatusAsync(reservationId, customerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ReservationStatus.Pending);
        _repository.Setup(r => r.UpdateStatusAsync(reservationId, customerId, ReservationStatus.Pending, ReservationStatus.Confirmed, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var outcome = await _sut.ChangeStatusAsync(reservationId, customerId, ReservationStatus.Confirmed);

        Assert.Equal(ReservationStatusUpdateOutcome.Conflict, outcome);
        _repository.Verify(r => r.GetStatusAsync(reservationId, customerId, It.IsAny<CancellationToken>()), Times.Once);
        _repository.Verify(r => r.UpdateStatusAsync(reservationId, customerId, ReservationStatus.Pending, ReservationStatus.Confirmed, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ChangeStatusAsync — CancellationToken & Exception Handling
    // ─────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ChangeStatusAsync_CancellationTokenProvided_ForwardsTokenToRepository()
    {
        using var cts = new CancellationTokenSource();
        var token = cts.Token;
        const int reservationId = 701;

        _repository.Setup(r => r.GetStatusAsync(reservationId, null, token))
            .ReturnsAsync(ReservationStatus.Pending);
        _repository.Setup(r => r.UpdateStatusAsync(reservationId, null, ReservationStatus.Pending, ReservationStatus.Confirmed, token))
            .ReturnsAsync(true);

        var outcome = await _sut.ChangeStatusAsync(reservationId, null, ReservationStatus.Confirmed, token);

        Assert.Equal(ReservationStatusUpdateOutcome.Updated, outcome);
        _repository.Verify(r => r.GetStatusAsync(reservationId, null, token), Times.Once);
        _repository.Verify(r => r.UpdateStatusAsync(reservationId, null, ReservationStatus.Pending, ReservationStatus.Confirmed, token), Times.Once);
    }

    [Fact]
    public async Task ChangeStatusAsync_RepositoryGetStatusThrows_ExceptionIsNotSwallowed()
    {
        _repository.Setup(r => r.GetStatusAsync(It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TimeoutException("Database read timed out"));

        var ex = await Assert.ThrowsAsync<TimeoutException>(() =>
            _sut.ChangeStatusAsync(1, 1, ReservationStatus.Confirmed));

        Assert.Equal("Database read timed out", ex.Message);
    }

    [Fact]
    public async Task ChangeStatusAsync_RepositoryUpdateStatusThrows_ExceptionIsNotSwallowed()
    {
        _repository.Setup(r => r.GetStatusAsync(It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(ReservationStatus.Pending);
        _repository.Setup(r => r.UpdateStatusAsync(It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Deadlock detected"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _sut.ChangeStatusAsync(1, 1, ReservationStatus.Confirmed));

        Assert.Equal("Deadlock detected", ex.Message);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // CancelForCustomerAsync Tests
    // ─────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CancelForCustomerAsync_SuccessfulCancellation_ReturnsCancelledOutcomeAndReservation()
    {
        using var cts = new CancellationTokenSource();
        var token = cts.Token;
        const int reservationId = 801;
        const int customerId = 33;
        var reservation = new ReservationService.Models.Reservation
        {
            Id = reservationId,
            CustomerId = customerId,
            Status = ReservationStatus.Cancelled,
            BookingReference = "CB-RES-801"
        };
        var expected = new ReservationCancellationResult(ReservationCancellationOutcome.Cancelled, reservation);

        _repository.Setup(r => r.CancelForCustomerAtomicallyAsync(reservationId, customerId, token))
            .ReturnsAsync(expected);

        var result = await _sut.CancelForCustomerAsync(reservationId, customerId, token);

        Assert.Same(expected, result);
        Assert.Equal(ReservationCancellationOutcome.Cancelled, result.Outcome);
        Assert.Equal("CB-RES-801", result.Reservation?.BookingReference);
        _repository.Verify(r => r.CancelForCustomerAtomicallyAsync(reservationId, customerId, token), Times.Once);
    }

    [Theory]
    [InlineData(ReservationCancellationOutcome.NotFound)]
    [InlineData(ReservationCancellationOutcome.InvalidState)]
    public async Task CancelForCustomerAsync_UnsuccessfulOutcomes_PropagatesResultUnchanged(ReservationCancellationOutcome outcome)
    {
        const int reservationId = 802;
        const int customerId = 33;
        var expected = new ReservationCancellationResult(outcome);

        _repository.Setup(r => r.CancelForCustomerAtomicallyAsync(reservationId, customerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var result = await _sut.CancelForCustomerAsync(reservationId, customerId);

        Assert.Same(expected, result);
        Assert.Equal(outcome, result.Outcome);
        Assert.Null(result.Reservation);
        _repository.Verify(r => r.CancelForCustomerAtomicallyAsync(reservationId, customerId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CancelForCustomerAsync_CancellationTokenProvided_ForwardsTokenToRepository()
    {
        using var cts = new CancellationTokenSource();
        var token = cts.Token;
        const int reservationId = 803;
        const int customerId = 44;
        var expected = new ReservationCancellationResult(ReservationCancellationOutcome.Cancelled);

        _repository.Setup(r => r.CancelForCustomerAtomicallyAsync(reservationId, customerId, token))
            .ReturnsAsync(expected);

        var result = await _sut.CancelForCustomerAsync(reservationId, customerId, token);

        Assert.Same(expected, result);
        _repository.Verify(r => r.CancelForCustomerAtomicallyAsync(reservationId, customerId, token), Times.Once);
    }

    [Fact]
    public async Task CancelForCustomerAsync_RepositoryThrows_ExceptionIsNotSwallowed()
    {
        _repository.Setup(r => r.CancelForCustomerAtomicallyAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TimeoutException("Database connection dropped"));

        var ex = await Assert.ThrowsAsync<TimeoutException>(() =>
            _sut.CancelForCustomerAsync(1, 1));

        Assert.Equal("Database connection dropped", ex.Message);
    }
}
